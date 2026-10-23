import crypto from "crypto";
import { env } from "./env";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 31 unambiguous characters (excludes 0, O, 1, I)

/**
 * Generate a cryptographically secure, high-entropy share token.
 * 24 random bytes = 192 bits of entropy, safe against unguessable lookup.
 */
export function generateShareToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

/**
 * Generate a human-friendly access code with high entropy.
 * Format: XXXX-XXXX (e.g. 7K9P-M2XQ)
 * 31^8 = ~852 billion combinations, with strict 5-attempt rate-limiting.
 */
export function generateAccessCode(): string {
  const bytes = crypto.randomBytes(8);
  let code = "";
  for (let i = 0; i < 8; i++) {
    const index = bytes[i] % CODE_ALPHABET.length;
    code += CODE_ALPHABET[index];
  }
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/**
 * Generate a cryptographically secure management token for early deletion.
 * 32 random bytes = 256 bits of entropy.
 */
export function generateManagementToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/**
 * Hash a high-entropy token using HMAC-SHA256 with the server-side secret pepper.
 * Raw tokens are never stored in the database.
 */
export function hashToken(token: string): string {
  return crypto
    .createHmac("sha256", env.HASH_SECRET)
    .update(token)
    .digest("hex");
}

/**
 * Normalize and hash an access code.
 * Removes hyphens, spaces, and forces uppercase.
 */
export function hashAccessCode(code: string): string {
  const normalized = code.replace(/[-\s]/g, "").toUpperCase();
  return crypto
    .createHmac("sha256", env.HASH_SECRET)
    .update(`access_code:${normalized}`)
    .digest("hex");
}

/**
 * Constant-time comparison to protect against timing attacks.
 */
export function timingSafeMatch(hashA: string, hashB: string): boolean {
  if (typeof hashA !== "string" || typeof hashB !== "string") {
    return false;
  }
  const bufA = Buffer.from(hashA, "hex");
  const bufB = Buffer.from(hashB, "hex");
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Create a short-lived, signed ephemeral read token for access-code authorized sessions.
 * Never stores anything in DB; verified via HMAC signature.
 */
export function createEphemeralToken(roomId: string, expiresAt: Date): string {
  const exp = Math.min(expiresAt.getTime(), Date.now() + 60 * 60 * 1000); // Max 1 hour
  const payload = `${roomId}:${exp}`;
  const sig = crypto
    .createHmac("sha256", env.HASH_SECRET)
    .update(`ephemeral:${payload}`)
    .digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

/**
 * Verify an ephemeral read token.
 */
export function verifyEphemeralToken(token: string): { valid: boolean; roomId?: string } {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const [roomId, expStr, sig] = decoded.split(":");
    if (!roomId || !expStr || !sig) {
      return { valid: false };
    }

    const exp = parseInt(expStr, 10);
    if (isNaN(exp) || Date.now() >= exp) {
      return { valid: false };
    }

    const expectedSig = crypto
      .createHmac("sha256", env.HASH_SECRET)
      .update(`ephemeral:${roomId}:${exp}`)
      .digest("hex");

    if (!timingSafeMatch(sig, expectedSig)) {
      return { valid: false };
    }

    return { valid: true, roomId };
  } catch {
    return { valid: false };
  }
}

