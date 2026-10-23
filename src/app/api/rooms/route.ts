import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { rooms, files } from "@/lib/db/schema";
import {
  generateShareToken,
  generateAccessCode,
  generateManagementToken,
  hashToken,
  hashAccessCode,
} from "@/lib/crypto";
import {
  validateDuration,
  sanitizeFilename,
  checkRateLimit,
  getClientIp,
} from "@/lib/security";
import { getStorageDriver } from "@/lib/storage";
import { env } from "@/lib/env";
import crypto from "crypto";

const fileInputSchema = z.object({
  name: z.string().min(1).max(255),
  size: z.number().int().positive(),
  type: z.string().max(128).default("application/octet-stream"),
});

const createRoomSchema = z.object({
  duration: z.union([z.string(), z.number()]),
  files: z.array(fileInputSchema).min(1),
});

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    // Rate limit: max 15 room creations per 10 minutes per IP
    const rl = checkRateLimit(`room_create:${ip}`, 15, 10 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a few minutes before creating another drop." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const parsed = createRoomSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request payload", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { duration, files: inputFiles } = parsed.data;

    // Check file count limit
    if (inputFiles.length > env.MAX_FILES_COUNT) {
      return NextResponse.json(
        { error: `Maximum of ${env.MAX_FILES_COUNT} files allowed per drop.` },
        { status: 400 }
      );
    }

    // Check individual and total file sizes
    const maxSingleBytes = env.MAX_FILE_SIZE_MB * 1024 * 1024;
    const maxTotalBytes = env.MAX_TOTAL_SIZE_MB * 1024 * 1024;
    let totalBytes = 0;

    for (const f of inputFiles) {
      if (f.size > maxSingleBytes) {
        return NextResponse.json(
          { error: `File "${f.name}" exceeds the maximum allowed size of ${env.MAX_FILE_SIZE_MB}MB.` },
          { status: 400 }
        );
      }
      totalBytes += f.size;
    }

    if (totalBytes > maxTotalBytes) {
      return NextResponse.json(
        { error: `Total drop size exceeds the limit of ${env.MAX_TOTAL_SIZE_MB}MB.` },
        { status: 400 }
      );
    }

    // Validate duration presets or custom seconds
    let durationSeconds: number;
    try {
      durationSeconds = validateDuration(duration);
    } catch (err: any) {
      return NextResponse.json({ error: err.message || "Invalid duration" }, { status: 400 });
    }

    // Generate cryptographic tokens
    const shareToken = generateShareToken();
    const accessCode = generateAccessCode();
    const managementToken = generateManagementToken();

    const shareTokenHash = hashToken(shareToken);
    const accessCodeHash = hashAccessCode(accessCode);
    const managementTokenHash = hashToken(managementToken);

    // Initial temporary expiry (activated upon upload completion)
    const initialExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour upload window

    const db = await getDb();
    const storage = getStorageDriver();

    const [createdRoom] = await db
      .insert(rooms)
      .values({
        shareTokenHash,
        accessCodeHash,
        managementTokenHash,
        status: "pending",
        totalBytes,
        fileCount: inputFiles.length,
        durationSeconds,
        expiresAt: initialExpiresAt,
      })
      .returning();

    // Prepare upload targets for each file
    const fileResponses = [];

    for (const f of inputFiles) {
      const fileId = crypto.randomUUID();
      const sanitized = sanitizeFilename(f.name);
      const storageKey = `drops/${createdRoom.id}/${fileId}_${sanitized}`;

      const uploadTarget = await storage.createUploadUrl(
        storageKey,
        f.type || "application/octet-stream",
        f.size
      );

      await db.insert(files).values({
        id: fileId,
        roomId: createdRoom.id,
        storageKey,
        originalFilename: sanitized,
        sizeBytes: f.size,
        mimeType: f.type || "application/octet-stream",
        status: "pending",
      });

      fileResponses.push({
        id: fileId,
        name: sanitized,
        size: f.size,
        type: f.type,
        uploadUrl: uploadTarget.uploadUrl,
        method: uploadTarget.method,
        headers: uploadTarget.headers,
      });
    }

    return NextResponse.json({
      roomId: createdRoom.id,
      shareToken,
      accessCode,
      managementToken,
      durationSeconds,
      files: fileResponses,
    });
  } catch (error: any) {
    console.error("Error creating room:", error);
    return NextResponse.json(
      { error: "Internal server error creating drop session." },
      { status: 500 }
    );
  }
}
