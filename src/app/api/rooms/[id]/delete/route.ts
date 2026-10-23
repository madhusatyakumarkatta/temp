import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { rooms } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { hashToken, timingSafeMatch } from "@/lib/crypto";
import { getStorageDriver } from "@/lib/storage";
import { processRoomDeletion } from "@/lib/cleanup";

const deleteSchema = z.object({
  managementToken: z.string().min(16),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Room ID is required." }, { status: 400 });
    }

    const body = await req.json();
    const parsed = deleteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Valid management token is required for deletion." },
        { status: 400 }
      );
    }

    const { managementToken } = parsed.data;
    const db = await getDb();
    const storage = getStorageDriver();

    const [room] = await db
      .select()
      .from(rooms)
      .where(eq(rooms.id, id));

    if (!room) {
      return NextResponse.json({ error: "Drop session not found." }, { status: 404 });
    }

    // Verify management token with constant-time comparison
    const providedHash = hashToken(managementToken);
    if (!timingSafeMatch(providedHash, room.managementTokenHash)) {
      return NextResponse.json(
        { error: "Invalid management token. Deletion unauthorized." },
        { status: 403 }
      );
    }

    // Immediately revoke and delete
    await db
      .update(rooms)
      .set({ status: "deleted", deletedAt: new Date() })
      .where(eq(rooms.id, room.id));

    // Process physical storage and database cleanup
    await processRoomDeletion(db, storage, room.id, "early_deletion");

    return NextResponse.json({
      success: true,
      message: "Drop and all associated files have been permanently deleted.",
    });
  } catch (error: any) {
    console.error("Error during early deletion:", error);
    return NextResponse.json(
      { error: "Failed to delete drop." },
      { status: 500 }
    );
  }
}
