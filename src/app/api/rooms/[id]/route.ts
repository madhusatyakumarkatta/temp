import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { rooms, files } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { hashToken } from "@/lib/crypto";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: token } = await params;
    if (!token) {
      return NextResponse.json({ error: "Share token is required." }, { status: 400 });
    }

    const tokenHash = hashToken(token);
    const db = await getDb();

    const [room] = await db
      .select()
      .from(rooms)
      .where(eq(rooms.shareTokenHash, tokenHash));

    if (!room) {
      return NextResponse.json(
        { error: "This drop does not exist or has already expired." },
        { status: 404 }
      );
    }

    const now = new Date();

    // Mandatory expiry and lifecycle enforcement
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

    return NextResponse.json({
      id: room.id,
      expiresAt: room.expiresAt.toISOString(),
      remainingSeconds,
      totalBytes: room.totalBytes,
      fileCount: roomFiles.length,
      files: roomFiles,
    });
  } catch (error: any) {
    console.error("Error retrieving room:", error);
    return NextResponse.json(
      { error: "Failed to retrieve drop details." },
      { status: 500 }
    );
  }
}
