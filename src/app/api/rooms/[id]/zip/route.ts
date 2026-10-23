import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { rooms, files } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { hashToken, verifyEphemeralToken } from "@/lib/crypto";
import { getStorageDriver } from "@/lib/storage";
import JSZip from "jszip";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: token } = await params;
    if (!token) {
      return NextResponse.json({ error: "Access token is required." }, { status: 400 });
    }

    const db = await getDb();
    const storage = getStorageDriver();

    let targetRoomId: string | null = null;

    // Check ephemeral token first
    const ephemeralCheck = verifyEphemeralToken(token);
    if (ephemeralCheck.valid && ephemeralCheck.roomId) {
      targetRoomId = ephemeralCheck.roomId;
    } else {
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

    const roomFiles = await db
      .select()
      .from(files)
      .where(eq(files.roomId, room.id));

    if (roomFiles.length === 0) {
      return NextResponse.json({ error: "No files available to package." }, { status: 404 });
    }

    const zip = new JSZip();

    for (const f of roomFiles) {
      try {
        const fileBuffer = await storage.getFileBuffer(f.storageKey);
        zip.file(f.originalFilename, fileBuffer);
      } catch (err) {
        console.error(`Failed to load file for zip: ${f.originalFilename}`, err);
      }
    }

    const zipBuffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    const shortId = room.id.slice(0, 8);
    const filename = `tempdrop-${shortId}.zip`;

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": zipBuffer.byteLength.toString(),
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error: any) {
    console.error("Error generating zip bundle:", error);
    return NextResponse.json(
      { error: "Failed to generate ZIP archive." },
      { status: 500 }
    );
  }
}
