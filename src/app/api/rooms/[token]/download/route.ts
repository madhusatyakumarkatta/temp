import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { rooms, files } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { hashToken, verifyEphemeralToken } from "@/lib/crypto";
import { getStorageDriver } from "@/lib/storage";
import { checkRateLimit, getClientIp } from "@/lib/security";

const downloadSchema = z.object({
  fileId: z.string().uuid(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const ip = getClientIp(req);
    // Rate limit downloads: max 60 downloads per minute per IP
    const rl = checkRateLimit(`download:${ip}`, 60, 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Download rate limit exceeded. Please wait a minute." },
        { status: 429 }
      );
    }

    const { token } = await params;
    if (!token) {
      return NextResponse.json({ error: "Access token is required." }, { status: 400 });
    }

    const body = await req.json();
    const parsed = downloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid file ID." }, { status: 400 });
    }

    const { fileId } = parsed.data;
    const db = await getDb();
    const storage = getStorageDriver();

    let targetRoomId: string | null = null;

    // Check if token is an ephemeral read token first
    const ephemeralCheck = verifyEphemeralToken(token);
    if (ephemeralCheck.valid && ephemeralCheck.roomId) {
      targetRoomId = ephemeralCheck.roomId;
    } else {
      // Otherwise test as a share token hash
      const tokenHash = hashToken(token);
      const [foundRoom] = await db
        .select({ id: rooms.id })
        .from(rooms)
        .where(eq(rooms.shareTokenHash, tokenHash));
      if (foundRoom) {
        targetRoomId = foundRoom.id;
      }
    }

    if (!targetRoomId) {
      return NextResponse.json(
        { error: "Invalid access token or drop has expired." },
        { status: 404 }
      );
    }

    const [room] = await db
      .select()
      .from(rooms)
      .where(eq(rooms.id, targetRoomId));

    if (!room) {
      return NextResponse.json(
        { error: "Drop does not exist or has expired." },
        { status: 404 }
      );
    }

    const now = new Date();
    // Mandatory expiry check
    if (room.status !== "active" || now >= room.expiresAt) {
      return NextResponse.json(
        { error: "This drop has expired and is no longer accessible." },
        { status: 410 }
      );
    }

    const [fileRecord] = await db
      .select()
      .from(files)
      .where(and(eq(files.id, fileId), eq(files.roomId, room.id)));

    if (!fileRecord || fileRecord.status !== "uploaded") {
      return NextResponse.json({ error: "File not found or unavailable." }, { status: 404 });
    }

    const remainingSeconds = Math.max(
      10,
      Math.floor((room.expiresAt.getTime() - now.getTime()) / 1000)
    );

    // Generate signed download URL strictly bounded by room expiry
    const downloadUrl = await storage.createDownloadUrl(
      fileRecord.storageKey,
      fileRecord.originalFilename,
      remainingSeconds
    );

    return NextResponse.json({
      downloadUrl,
      filename: fileRecord.originalFilename,
      sizeBytes: fileRecord.sizeBytes,
      mimeType: fileRecord.mimeType,
    });
  } catch (error: any) {
    console.error("Error generating download URL:", error);
    return NextResponse.json(
      { error: "Failed to authorize file download." },
      { status: 500 }
    );
  }
}
