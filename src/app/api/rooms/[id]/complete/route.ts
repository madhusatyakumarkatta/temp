import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { rooms, files } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getStorageDriver } from "@/lib/storage";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing room id." }, { status: 400 });
    }

    const db = await getDb();
    const storage = getStorageDriver();

    const [room] = await db.select().from(rooms).where(eq(rooms.id, id));

    if (!room) {
      return NextResponse.json({ error: "Drop session not found." }, { status: 404 });
    }

    if (room.status !== "pending") {
      return NextResponse.json(
        { error: "Drop is already finalized or no longer active." },
        { status: 400 }
      );
    }

    const roomFiles = await db.select().from(files).where(eq(files.roomId, room.id));

    if (roomFiles.length === 0) {
      return NextResponse.json(
        { error: "No files found for this drop session." },
        { status: 400 }
      );
    }

    // Verify each file physically in storage
    const missingFiles: string[] = [];
    for (const f of roomFiles) {
      const check = await storage.verifyObject(f.storageKey);
      if (!check.exists) {
        missingFiles.push(f.originalFilename);
      }
    }

    if (missingFiles.length > 0) {
      return NextResponse.json(
        {
          error: "Upload verification failed. Some files were not successfully uploaded.",
          missingFiles,
        },
        { status: 400 }
      );
    }

    // Calculate official expiry strictly using server clock in UTC
    const now = Date.now();
    const expiresAt = new Date(now + room.durationSeconds * 1000);

    // Activate room and mark files uploaded
    await db
      .update(rooms)
      .set({
        status: "active",
        expiresAt,
      })
      .where(eq(rooms.id, room.id));

    await db
      .update(files)
      .set({ status: "uploaded" })
      .where(eq(files.roomId, room.id));

    return NextResponse.json({
      success: true,
      status: "active",
      expiresAt: expiresAt.toISOString(),
      durationSeconds: room.durationSeconds,
    });
  } catch (error: any) {
    console.error("Error finalizing room upload:", error);
    return NextResponse.json(
      { error: "Failed to finalize drop upload." },
      { status: 500 }
    );
  }
}
