import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().optional(),
  STORAGE_DRIVER: z.enum(["r2", "local"]).default("local"),
  
  // Cloudflare R2 / S3 Config
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  R2_PUBLIC_URL: z.string().optional(),

  // Secrets & Hashes
  HASH_SECRET: z.string().min(16).default("tempdrop-dev-hash-secret-minimum-32-chars-long!"),
  CLEANUP_SECRET: z.string().min(8).default("tempdrop-cleanup-dev-key"),

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
    STORAGE_DRIVER: process.env.STORAGE_DRIVER || (process.env.R2_ACCESS_KEY_ID ? "r2" : "local"),
    R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
    R2_PUBLIC_URL: process.env.R2_PUBLIC_URL,
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
} catch (error) {
  console.error("Environment configuration error:", error);
  // Fall back to defaults for development
  parsedEnv = envSchema.parse({});
}

export const env = parsedEnv;
