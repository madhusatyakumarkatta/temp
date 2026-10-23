import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { rooms, files } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { hashAccessCode, createEphemeralToken } from "@/lib/crypto";
import { checkRateLimit, getClientIp } from "@/lib/security";

const accessSchema = z.object({
  code: z.string().min(4).max(32),
});

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    // Strict rate limiting: max 5 code attempts per 5 minutes to prevent brute-force attacks
    const rl = checkRateLimit(`access_code:${ip}`, 5, 5 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        {
          error: "Too many access code attempts. Please wait 5 minutes before trying again.",
          retryAfterMs: rl.resetMs,
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const parsed = accessSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid access code format." },
        { status: 400 }
      );
    }

    const codeHash = hashAccessCode(parsed.data.code);
    const db = await getDb();

    const [room] = await db
      .select()
      .from(rooms)
      .where(eq(rooms.accessCodeHash, codeHash));

    if (!room) {
      return NextResponse.json(
        { error: "Invalid access code or drop has expired." },
        { status: 404 }
      );
    }

    const now = new Date();
    if (room.status !== "active" || now >= room.expiresAt) {
      return NextResponse.json(
        { error: "This drop has expired and is no longer accessible." },
        { status: 410 }
      );
    }

    const roomFiles = await db
      .select({
        id: files.id,
        filename: files.originalFilename,
        sizeBytes: files.sizeBytes,
        mimeType: files.mimeType,
      })
      .from(files)
      .where(eq(files.roomId, room.id));

    const remainingSeconds = Math.max(
      0,
      Math.floor((room.expiresAt.getTime() - now.getTime()) / 1000)
    );

    const readToken = createEphemeralToken(room.id, room.expiresAt);

    return NextResponse.json({
      id: room.id,
      readToken,
      expiresAt: room.expiresAt.toISOString(),
      remainingSeconds,
      totalBytes: room.totalBytes,
      fileCount: roomFiles.length,
      files: roomFiles,
    });
  } catch (error: any) {
    console.error("Error verifying access code:", error);
    return NextResponse.json(
      { error: "Failed to verify access code." },
      { status: 500 }
    );
  }
}
