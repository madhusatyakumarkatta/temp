import "server-only";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().optional(),
  STORAGE_DRIVER: z.enum(["supabase", "local"]).default("local"),
  
  // Supabase Configuration
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().default("doingdrop-files"),

  // Secrets & Hashes (strict in production, safe defaults for offline local tests)
  HASH_SECRET: z.string().min(16).default("doingdrop-dev-hash-secret-minimum-32-chars-long!"),
  CLEANUP_SECRET: z.string().min(8).default("doingdrop-cleanup-dev-key"),

  // Application limits
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  MAX_FILE_SIZE_MB: z.coerce.number().positive().default(100),
  MAX_TOTAL_SIZE_MB: z.coerce.number().positive().default(500),
  MAX_FILES_COUNT: z.coerce.number().positive().default(20),
  DEFAULT_EXPIRY_SECONDS: z.coerce.number().positive().default(86400), // 24 hours
  MAX_EXPIRY_SECONDS: z.coerce.number().positive().default(604800), // 7 days
  MIN_EXPIRY_SECONDS: z.coerce.number().positive().default(300), // 5 minutes
});

export type Env = z.infer<typeof envSchema>;

let parsedEnv: Env;

try {
  parsedEnv = envSchema.parse({
    DATABASE_URL: process.env.DATABASE_URL,
    STORAGE_DRIVER:
      process.env.STORAGE_DRIVER ||
      (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
        ? "supabase"
        : "local"),
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_STORAGE_BUCKET: process.env.SUPABASE_STORAGE_BUCKET || "doingdrop-files",
    HASH_SECRET: process.env.HASH_SECRET,
    CLEANUP_SECRET: process.env.CLEANUP_SECRET,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    MAX_FILE_SIZE_MB: process.env.MAX_FILE_SIZE_MB,
    MAX_TOTAL_SIZE_MB: process.env.MAX_TOTAL_SIZE_MB,
    MAX_FILES_COUNT: process.env.MAX_FILES_COUNT,
    DEFAULT_EXPIRY_SECONDS: process.env.DEFAULT_EXPIRY_SECONDS,
    MAX_EXPIRY_SECONDS: process.env.MAX_EXPIRY_SECONDS,
    MIN_EXPIRY_SECONDS: process.env.MIN_EXPIRY_SECONDS,
  });

  if (process.env.NODE_ENV === "production") {
    if (parsedEnv.HASH_SECRET === "doingdrop-dev-hash-secret-minimum-32-chars-long!") {
      console.warn("WARNING: HASH_SECRET is using the development fallback. Set a unique random 32-byte secret in production!");
    }
  }
} catch (error) {
  if (process.env.NODE_ENV === "production") {
    console.error("FATAL: Environment configuration error in production:", error);
    throw new Error("Invalid production environment configuration: " + String(error));
  }
  console.error("Environment configuration error:", error);
  parsedEnv = envSchema.parse({});
}

export const env = parsedEnv;
