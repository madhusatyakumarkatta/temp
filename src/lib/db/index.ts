import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import postgres from "postgres";
import { PGlite } from "@electric-sql/pglite";
import * as schema from "./schema";
import { env } from "../env";
import path from "path";
import fs from "fs";

let dbInstance: any = null;
let isInitialized = false;

export async function getDb() {
  if (dbInstance) {
    return dbInstance;
  }

  if (env.DATABASE_URL && env.DATABASE_URL.startsWith("postgres")) {
    const client = postgres(env.DATABASE_URL, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    });
    dbInstance = drizzlePg(client, { schema });
    return dbInstance;
  }

  // Fallback to local in-process PostgreSQL via PGlite
  const dataDir = path.join(process.cwd(), ".pgdata");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const pglite = new PGlite(dataDir);
  dbInstance = drizzlePglite(pglite, { schema });

  // Auto-initialize tables for PGlite if needed
  if (!isInitialized) {
    try {
      await pglite.exec(`
        CREATE TABLE IF NOT EXISTS rooms (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          share_token_hash TEXT NOT NULL UNIQUE,
          access_code_hash TEXT NOT NULL,
          management_token_hash TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          total_bytes BIGINT NOT NULL DEFAULT 0,
          file_count INTEGER NOT NULL DEFAULT 0,
          duration_seconds INTEGER NOT NULL DEFAULT 86400,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          expires_at TIMESTAMPTZ NOT NULL,
          deleted_at TIMESTAMPTZ
        );

        CREATE TABLE IF NOT EXISTS files (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
          storage_key TEXT NOT NULL,
          original_filename TEXT NOT NULL,
          size_bytes BIGINT NOT NULL,
          mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
          status TEXT NOT NULL DEFAULT 'pending',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS cleanup_jobs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          room_id TEXT NOT NULL,
          reason TEXT NOT NULL,
          attempts INTEGER NOT NULL DEFAULT 0,
          last_error TEXT,
          next_run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_rooms_share_token_hash ON rooms(share_token_hash);
        CREATE INDEX IF NOT EXISTS idx_rooms_access_code_hash ON rooms(access_code_hash);
        CREATE INDEX IF NOT EXISTS idx_rooms_management_token_hash ON rooms(management_token_hash);
        CREATE INDEX IF NOT EXISTS idx_rooms_expires_at ON rooms(expires_at);
        CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
        CREATE INDEX IF NOT EXISTS idx_files_room_id ON files(room_id);
        CREATE INDEX IF NOT EXISTS idx_files_storage_key ON files(storage_key);
        CREATE INDEX IF NOT EXISTS idx_cleanup_jobs_next_run_at ON cleanup_jobs(next_run_at);
      `);
      isInitialized = true;
    } catch (err) {
      console.error("Failed to initialize PGlite schema:", err);
    }
  }

  return dbInstance;
}

export { schema };
