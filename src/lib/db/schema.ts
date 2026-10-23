import { pgTable, text, timestamp, integer, bigint, uuid, index } from "drizzle-orm/pg-core";

export const rooms = pgTable(
  "rooms",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shareTokenHash: text("share_token_hash").notNull().unique(),
    accessCodeHash: text("access_code_hash").notNull(),
    managementTokenHash: text("management_token_hash").notNull(),
    status: text("status", { enum: ["pending", "active", "expired", "deleted"] })
      .notNull()
      .default("pending"),
    totalBytes: bigint("total_bytes", { mode: "number" }).notNull().default(0),
    fileCount: integer("file_count").notNull().default(0),
    durationSeconds: integer("duration_seconds").notNull().default(86400),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_rooms_share_token_hash").on(table.shareTokenHash),
    index("idx_rooms_access_code_hash").on(table.accessCodeHash),
    index("idx_rooms_management_token_hash").on(table.managementTokenHash),
    index("idx_rooms_expires_at").on(table.expiresAt),
    index("idx_rooms_status").on(table.status),
  ]
);

export const files = pgTable(
  "files",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull(),
    originalFilename: text("original_filename").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    mimeType: text("mime_type").notNull().default("application/octet-stream"),
    status: text("status", { enum: ["pending", "uploaded", "deleted"] })
      .notNull()
      .default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_files_room_id").on(table.roomId),
    index("idx_files_storage_key").on(table.storageKey),
  ]
);

export const cleanupJobs = pgTable(
  "cleanup_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    roomId: text("room_id").notNull(),
    reason: text("reason", { enum: ["expired", "early_deletion", "abandoned"] }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_cleanup_jobs_next_run_at").on(table.nextRunAt),
    index("idx_cleanup_jobs_room_id").on(table.roomId),
  ]
);

export type Room = typeof rooms.$inferSelect;
export type NewRoom = typeof rooms.$inferInsert;
export type FileRecord = typeof files.$inferSelect;
export type NewFileRecord = typeof files.$inferInsert;
export type CleanupJob = typeof cleanupJobs.$inferSelect;
export type NewCleanupJob = typeof cleanupJobs.$inferInsert;
