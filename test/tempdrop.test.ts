import { describe, it, expect, beforeEach } from "vitest";
import {
  validateDuration,
  sanitizeFilename,
  checkRateLimit,
  EXPIRY_PRESETS,
} from "../src/lib/security";
import {
  generateShareToken,
  generateAccessCode,
  generateManagementToken,
  hashToken,
  hashAccessCode,
  timingSafeMatch,
  createEphemeralToken,
  verifyEphemeralToken,
} from "../src/lib/crypto";
import { getDb } from "../src/lib/db";
import { rooms, files, cleanupJobs } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";
import { runCleanupWorker, processRoomDeletion } from "../src/lib/cleanup";
import { LocalStorageDriver } from "../src/lib/storage/local";

describe("TempDrop Security & Validation Suite", () => {
  describe("Duration & Expiry Presets", () => {
    it("validates the default 24-hour preset", () => {
      const seconds = validateDuration("24h");
      expect(seconds).toBe(86400);
    });

    it("validates every permitted expiry preset accurately", () => {
      expect(validateDuration("10m")).toBe(600);
      expect(validateDuration("1h")).toBe(3600);
      expect(validateDuration("6h")).toBe(21600);
      expect(validateDuration("24h")).toBe(86400);
      expect(validateDuration("3d")).toBe(259200);
      expect(validateDuration("7d")).toBe(604800);
    });

    it("accepts valid custom duration within permitted bounds", () => {
      expect(validateDuration(3600 * 12)).toBe(43200); // 12 hours
      expect(validateDuration("7200")).toBe(7200); // 2 hours
    });

    it("rejects out-of-range or invalid durations", () => {
      // Below 5 minutes (300s)
      expect(() => validateDuration(100)).toThrow();
      expect(() => validateDuration("1m")).toThrow();

      // Above 7 days (604800s)
      expect(() => validateDuration(700000)).toThrow();
      expect(() => validateDuration("14d")).toThrow();

      // Malformed strings
      expect(() => validateDuration("invalid")).toThrow();
    });
  });

  describe("Filename Sanitization & Path Traversal Prevention", () => {
    it("strips directory traversal paths", () => {
      expect(sanitizeFilename("../../etc/passwd")).toBe("passwd");
      expect(sanitizeFilename("..\\..\\windows\\system32\\calc.exe")).toBe("calc.exe");
    });

    it("replaces dangerous filesystem characters", () => {
      expect(sanitizeFilename('file:*?"<>|.txt')).toBe("file_______.txt");
    });

    it("prevents Windows reserved device names", () => {
      expect(sanitizeFilename("CON.txt")).toBe("file_CON.txt");
      expect(sanitizeFilename("aux")).toBe("file_aux");
      expect(sanitizeFilename("prn.pdf")).toBe("file_prn.pdf");
    });

    it("truncates oversized filenames while preserving extension", () => {
      const longName = "a".repeat(250) + ".png";
      const sanitized = sanitizeFilename(longName);
      expect(sanitized.length).toBeLessThanOrEqual(200);
      expect(sanitized.endsWith(".png")).toBe(true);
    });
  });

  describe("Cryptographic Tokens & Hashing", () => {
    it("generates unguessable, high-entropy tokens", () => {
      const token1 = generateShareToken();
      const token2 = generateShareToken();
      expect(token1).not.toBe(token2);
      expect(token1.length).toBeGreaterThanOrEqual(30);

      const code1 = generateAccessCode();
      const code2 = generateAccessCode();
      expect(code1).not.toBe(code2);
      expect(code1).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/); // 8 chars with hyphen
    });

    it("performs constant-time hash comparisons", () => {
      const token = "secret-token-123";
      const hash1 = hashToken(token);
      const hash2 = hashToken(token);
      const hash3 = hashToken("different-token");

      expect(timingSafeMatch(hash1, hash2)).toBe(true);
      expect(timingSafeMatch(hash1, hash3)).toBe(false);
    });

    it("creates and verifies ephemeral read tokens", () => {
      const roomId = "test-room-uuid";
      const futureExpiry = new Date(Date.now() + 60000);
      const token = createEphemeralToken(roomId, futureExpiry);

      const verification = verifyEphemeralToken(token);
      expect(verification.valid).toBe(true);
      expect(verification.roomId).toBe(roomId);

      // Verify tampered token fails
      const tampered = token.slice(0, -3) + "xyz";
      expect(verifyEphemeralToken(tampered).valid).toBe(false);
    });
  });

  describe("Rate Limiter", () => {
    it("allows requests up to limit and denies excess", () => {
      const testKey = `test_ip_${Date.now()}`;
      const limit = 3;
      const windowMs = 1000;

      expect(checkRateLimit(testKey, limit, windowMs).allowed).toBe(true);
      expect(checkRateLimit(testKey, limit, windowMs).allowed).toBe(true);
      expect(checkRateLimit(testKey, limit, windowMs).allowed).toBe(true);
      // 4th request exceeds limit
      expect(checkRateLimit(testKey, limit, windowMs).allowed).toBe(false);
    });
  });

  describe("Database Lifecycle, Expiry Enforcement & Deletion", () => {
    it("creates, retrieves, and enforces expiry boundaries", async () => {
      const db = await getDb();
      const shareToken = generateShareToken();
      const shareTokenHash = hashToken(shareToken);
      const accessCode = generateAccessCode();
      const accessCodeHash = hashAccessCode(accessCode);
      const managementToken = generateManagementToken();
      const managementTokenHash = hashToken(managementToken);

      // 1. Create active room expiring in 10 minutes
      const [room] = await db
        .insert(rooms)
        .values({
          shareTokenHash,
          accessCodeHash,
          managementTokenHash,
          status: "active",
          totalBytes: 1024,
          fileCount: 1,
          durationSeconds: 600,
          expiresAt: new Date(Date.now() + 600 * 1000),
        })
        .returning();

      expect(room.id).toBeDefined();

      // Retrieve by share token hash
      const [foundRoom] = await db
        .select()
        .from(rooms)
        .where(eq(rooms.shareTokenHash, shareTokenHash));
      expect(foundRoom.id).toBe(room.id);

      // Retrieve by access code hash
      const [foundByCode] = await db
        .select()
        .from(rooms)
        .where(eq(rooms.accessCodeHash, accessCodeHash));
      expect(foundByCode.id).toBe(room.id);

      // 2. Test server-side expiry boundary
      await db
        .update(rooms)
        .set({ expiresAt: new Date(Date.now() - 1000) }) // 1 second in the past
        .where(eq(rooms.id, room.id));

      const [expiredRoom] = await db
        .select()
        .from(rooms)
        .where(eq(rooms.id, room.id));

      expect(new Date() >= expiredRoom.expiresAt).toBe(true);
    });

    it("supports early deletion with management credential", async () => {
      const db = await getDb();
      const storage = new LocalStorageDriver();

      const shareToken = generateShareToken();
      const managementToken = generateManagementToken();
      const managementTokenHash = hashToken(managementToken);

      const [room] = await db
        .insert(rooms)
        .values({
          shareTokenHash: hashToken(shareToken),
          accessCodeHash: hashAccessCode(generateAccessCode()),
          managementTokenHash,
          status: "active",
          totalBytes: 500,
          fileCount: 1,
          durationSeconds: 3600,
          expiresAt: new Date(Date.now() + 3600 * 1000),
        })
        .returning();

      // Add dummy file
      const dummyKey = `drops/${room.id}/test_file.txt`;
      await storage.saveFile(dummyKey, Buffer.from("Hello TempDrop"));

      await db.insert(files).values({
        roomId: room.id,
        storageKey: dummyKey,
        originalFilename: "test_file.txt",
        sizeBytes: 14,
        status: "uploaded",
      });

      // Verify file exists in storage
      const checkBefore = await storage.verifyObject(dummyKey);
      expect(checkBefore.exists).toBe(true);

      // Perform early deletion
      const success = await processRoomDeletion(db, storage, room.id, "early_deletion");
      expect(success).toBe(true);

      // Verify file removed from storage
      const checkAfter = await storage.verifyObject(dummyKey);
      expect(checkAfter.exists).toBe(false);

      // Verify room removed from database
      const [deletedRoom] = await db
        .select()
        .from(rooms)
        .where(eq(rooms.id, room.id));
      expect(deletedRoom).toBeUndefined();
    });

    it("runs cleanup worker idempotently on expired rooms", async () => {
      const db = await getDb();
      const storage = new LocalStorageDriver();

      // Insert an expired room
      const [expiredRoom] = await db
        .insert(rooms)
        .values({
          shareTokenHash: hashToken(generateShareToken()),
          accessCodeHash: hashAccessCode(generateAccessCode()),
          managementTokenHash: hashToken(generateManagementToken()),
          status: "active",
          totalBytes: 100,
          fileCount: 1,
          durationSeconds: 60,
          expiresAt: new Date(Date.now() - 5000), // Expired 5 seconds ago
        })
        .returning();

      const fileKey = `drops/${expiredRoom.id}/cleanup_test.txt`;
      await storage.saveFile(fileKey, Buffer.from("to be deleted"));

      await db.insert(files).values({
        roomId: expiredRoom.id,
        storageKey: fileKey,
        originalFilename: "cleanup_test.txt",
        sizeBytes: 13,
        status: "uploaded",
      });

      // Run cleanup worker
      const result = await runCleanupWorker();
      expect(result.expiredRoomsRevoked).toBeGreaterThanOrEqual(1);
      expect(result.objectsDeleted).toBeGreaterThanOrEqual(1);

      // Verify file is gone
      const check = await storage.verifyObject(fileKey);
      expect(check.exists).toBe(false);

      // Running cleanup again should be idempotent and not error
      const secondResult = await runCleanupWorker();
      expect(secondResult.alerts.length).toBe(0);
    });
  });
});
