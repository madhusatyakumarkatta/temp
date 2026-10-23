import { getDb } from "./db";
import { rooms, files, cleanupJobs } from "./db/schema";
import { eq, and, lte } from "drizzle-orm";
import { getStorageDriver } from "./storage";

export interface CleanupResult {
  expiredRoomsRevoked: number;
  abandonedRoomsRevoked: number;
  objectsDeleted: number;
  failedDeletions: number;
  jobsProcessed: number;
  jobsRetried: number;
  alerts: string[];
}

/**
 * Execute the automated cleanup worker:
 * - Revokes access immediately for expired and abandoned rooms
 * - Deletes associated objects from private storage
 * - Removes database records and sensitive metadata
 * - Retries failed deletions with bounded exponential backoff
 */
export async function runCleanupWorker(): Promise<CleanupResult> {
  const db = await getDb();
  const storage = getStorageDriver();
  const now = new Date();

  const result: CleanupResult = {
    expiredRoomsRevoked: 0,
    abandonedRoomsRevoked: 0,
    objectsDeleted: 0,
    failedDeletions: 0,
    jobsProcessed: 0,
    jobsRetried: 0,
    alerts: [],
  };

  // 1. Identify expired active rooms
  const expiredRooms = await db
    .select()
    .from(rooms)
    .where(and(eq(rooms.status, "active"), lte(rooms.expiresAt, now)));

  // 2. Identify abandoned pending rooms older than 1 hour
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const abandonedRooms = await db
    .select()
    .from(rooms)
    .where(and(eq(rooms.status, "pending"), lte(rooms.createdAt, oneHourAgo)));

  const roomsToClean = [...expiredRooms, ...abandonedRooms];

  // Immediately revoke access at database level
  for (const r of expiredRooms) {
    await db
      .update(rooms)
      .set({ status: "expired" })
      .where(eq(rooms.id, r.id));
    result.expiredRoomsRevoked++;
  }

  for (const r of abandonedRooms) {
    await db
      .update(rooms)
      .set({ status: "expired" })
      .where(eq(rooms.id, r.id));
    result.abandonedRoomsRevoked++;
  }

  // 3. Process physical object deletion for newly expired/abandoned rooms
  for (const r of roomsToClean) {
    await processRoomDeletion(db, storage, r.id, r.status === "pending" ? "abandoned" : "expired", result);
  }

  // 4. Process retry queue from cleanup_jobs
  const pendingJobs = await db
    .select()
    .from(cleanupJobs)
    .where(lte(cleanupJobs.nextRunAt, now));

  for (const job of pendingJobs) {
    result.jobsProcessed++;
    const success = await retryRoomDeletion(db, storage, job, result);
    if (success) {
      // Remove job on successful cleanup
      await db.delete(cleanupJobs).where(eq(cleanupJobs.id, job.id));
    }
  }

  return result;
}

/**
 * Handle deletion of objects and DB records for a single room
 */
export async function processRoomDeletion(
  db: any,
  storage: any,
  roomId: string,
  reason: "expired" | "early_deletion" | "abandoned",
  result?: CleanupResult
): Promise<boolean> {
  // Find all files associated with this room
  const roomFiles = await db
    .select()
    .from(files)
    .where(eq(files.roomId, roomId));

  const storageKeys = roomFiles.map((f: any) => f.storageKey).filter(Boolean);

  let allDeleted = true;

  if (storageKeys.length > 0) {
    const { deleted, failed } = await storage.deleteObjects(storageKeys);

    if (result) {
      result.objectsDeleted += deleted.length;
      result.failedDeletions += failed.length;
    }

    if (failed.length > 0) {
      allDeleted = false;
      // Enqueue retry job with exponential backoff
      await db.insert(cleanupJobs).values({
        roomId,
        reason,
        attempts: 1,
        lastError: `Failed to delete ${failed.length} objects`,
        nextRunAt: new Date(Date.now() + 2 * 60 * 1000), // Retry in 2 mins
      });
    }
  }

  if (allDeleted) {
    // Delete files records
    await db.delete(files).where(eq(files.roomId, roomId));

    // Permanently remove room or strip all metadata
    await db.delete(rooms).where(eq(rooms.id, roomId));
    return true;
  }

  return false;
}

/**
 * Retry failed deletion from cleanup_jobs with bounded exponential backoff
 */
async function retryRoomDeletion(
  db: any,
  storage: any,
  job: any,
  result: CleanupResult
): Promise<boolean> {
  const roomFiles = await db
    .select()
    .from(files)
    .where(eq(files.roomId, job.roomId));

  const storageKeys = roomFiles.map((f: any) => f.storageKey).filter(Boolean);

  if (storageKeys.length === 0) {
    // Already cleaned from storage, clean up DB
    await db.delete(files).where(eq(files.roomId, job.roomId));
    await db.delete(rooms).where(eq(rooms.id, job.roomId));
    return true;
  }

  const { deleted, failed } = await storage.deleteObjects(storageKeys);
  result.objectsDeleted += deleted.length;

  if (failed.length === 0) {
    await db.delete(files).where(eq(files.roomId, job.roomId));
    await db.delete(rooms).where(eq(rooms.id, job.roomId));
    return true;
  }

  // Still failing, increment attempts and calculate exponential backoff
  const nextAttempts = job.attempts + 1;
  result.jobsRetried++;

  if (nextAttempts >= 5) {
    const alertMsg = `[CRITICAL_CLEANUP_FAILURE] Room ${job.roomId} failed cleanup after 5 attempts. Operator intervention required.`;
    console.error(alertMsg);
    result.alerts.push(alertMsg);

    // Keep job with high nextRunAt to prevent busy loop, alerting operator
    await db
      .update(cleanupJobs)
      .set({
        attempts: nextAttempts,
        lastError: `Exceeded max retries. Unrecovered keys: ${failed.join(", ")}`,
        nextRunAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Check once a day
      })
      .where(eq(cleanupJobs.id, job.id));
    return false;
  }

  // Exponential backoff: 2^attempts minutes
  const backoffMinutes = Math.pow(2, nextAttempts);
  await db
    .update(cleanupJobs)
    .set({
      attempts: nextAttempts,
      lastError: `Failed ${failed.length} keys on attempt ${nextAttempts}`,
      nextRunAt: new Date(Date.now() + backoffMinutes * 60 * 1000),
    })
    .where(eq(cleanupJobs.id, job.id));

  return false;
}
