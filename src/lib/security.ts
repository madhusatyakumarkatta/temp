import { env } from "./env";
import path from "path";

/**
 * Standard duration presets in seconds
 */
export const EXPIRY_PRESETS: Record<string, number> = {
  "10m": 10 * 60, // 600s
  "1h": 60 * 60, // 3600s
  "6h": 6 * 60 * 60, // 21600s
  "24h": 24 * 60 * 60, // 86400s (Default)
  "3d": 3 * 24 * 60 * 60, // 259200s
  "7d": 7 * 24 * 60 * 60, // 604800s
};

/**
 * Validate and calculate retention duration in seconds.
 * Strictly bounded between MIN_EXPIRY_SECONDS and MAX_EXPIRY_SECONDS.
 */
export function validateDuration(presetOrSeconds: string | number): number {
  let seconds: number;

  if (typeof presetOrSeconds === "string") {
    if (presetOrSeconds in EXPIRY_PRESETS) {
      seconds = EXPIRY_PRESETS[presetOrSeconds];
    } else {
      const parsed = parseInt(presetOrSeconds, 10);
      if (isNaN(parsed)) {
        throw new Error("Invalid duration format");
      }
      seconds = parsed;
    }
  } else if (typeof presetOrSeconds === "number") {
    seconds = Math.floor(presetOrSeconds);
  } else {
    throw new Error("Invalid duration type");
  }

  if (seconds < env.MIN_EXPIRY_SECONDS) {
    throw new Error(`Duration cannot be less than ${env.MIN_EXPIRY_SECONDS / 60} minutes`);
  }
  if (seconds > env.MAX_EXPIRY_SECONDS) {
    throw new Error(`Duration cannot exceed ${env.MAX_EXPIRY_SECONDS / 86400} days`);
  }

  return seconds;
}

/**
 * Sanitize a user-provided filename:
 * - Strips directory traversal (../, ..\)
 * - Strips null bytes and control characters
 * - Strips dangerous OS characters: < > : " / \ | ? *
 * - Guards against reserved Windows filenames (CON, PRN, AUX, NUL, COM1-9, LPT1-9)
 * - Limits length to 200 characters while preserving extension
 */
export function sanitizeFilename(rawName: string): string {
  if (!rawName || typeof rawName !== "string") {
    return "unnamed-file";
  }

  // Extract base name to strip paths
  let clean = path.basename(rawName.trim());

  // Remove null bytes and control chars
  clean = clean.replace(/[\x00-\x1f\x7f]/g, "");

  // Replace invalid filesystem characters
  clean = clean.replace(/[<>:"/\\|?*]/g, "_");

  // Prevent Windows reserved device names
  const reservedRegex = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\..*)?$/i;
  if (reservedRegex.test(clean)) {
    clean = `file_${clean}`;
  }

  // Fallback if empty
  if (!clean || clean === "." || clean === "..") {
    clean = "unnamed-file";
  }

  // Truncate length if needed, preserving extension
  if (clean.length > 200) {
    const ext = path.extname(clean);
    const base = path.basename(clean, ext);
    clean = `${base.slice(0, 200 - ext.length)}${ext}`;
  }

  return clean;
}

// In-memory sliding window rate limiter
interface RateLimitRecord {
  timestamps: number[];
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Clean up stale rate limit entries every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitStore.entries()) {
      record.timestamps = record.timestamps.filter((ts) => now - ts < 15 * 60 * 1000);
      if (record.timestamps.length === 0) {
        rateLimitStore.delete(key);
      }
    }
  }, 5 * 60 * 1000).unref?.();
}

/**
 * Rate limit check using sliding window
 * @param identifier e.g. "room_create:192.168.1.1" or "code_verify:192.168.1.1"
 * @param maxRequests maximum allowed within windowMs
 * @param windowMs time window in milliseconds
 */
export function checkRateLimit(
  identifier: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetMs: number } {
  const now = Date.now();
  let record = rateLimitStore.get(identifier);

  if (!record) {
    record = { timestamps: [] };
    rateLimitStore.set(identifier, record);
  }

  // Filter timestamps within the current window
  record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);

  if (record.timestamps.length >= maxRequests) {
    const oldestInWindow = record.timestamps[0];
    const resetMs = Math.max(0, oldestInWindow + windowMs - now);
    return {
      allowed: false,
      remaining: 0,
      resetMs,
    };
  }

  record.timestamps.push(now);
  return {
    allowed: true,
    remaining: maxRequests - record.timestamps.length,
    resetMs: windowMs,
  };
}

/**
 * Extract client IP address safely from Request headers
 */
export function getClientIp(req: Request): string {
  const xForwardedFor = req.headers.get("x-forwarded-for");
  if (xForwardedFor) {
    const ips = xForwardedFor.split(",").map((ip) => ip.trim());
    if (ips[0]) return ips[0];
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  const cfConnectingIp = req.headers.get("cf-connecting-ip");
  if (cfConnectingIp) return cfConnectingIp.trim();
  return "127.0.0.1";
}
