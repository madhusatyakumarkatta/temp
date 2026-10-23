-- ==============================================================================
-- doingdrop — Supabase Database Migration & Row-Level Security (RLS)
-- ==============================================================================

-- 1. Create Rooms Table
CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_token_hash TEXT NOT NULL UNIQUE,
  access_code_hash TEXT NOT NULL,
  management_token_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'expired', 'deleted')),
  total_bytes BIGINT NOT NULL DEFAULT 0,
  file_count INTEGER NOT NULL DEFAULT 0,
  duration_seconds INTEGER NOT NULL DEFAULT 86400,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ
);

-- 2. Create Files Table
CREATE TABLE IF NOT EXISTS files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  storage_key TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'uploaded', 'deleted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create Cleanup Jobs Table (Retry Queue for Failed Deletions)
CREATE TABLE IF NOT EXISTS cleanup_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('expired', 'early_deletion', 'abandoned')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  next_run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Create Indexes for High-Speed Lookups & Expiry Scanning
CREATE INDEX IF NOT EXISTS idx_rooms_share_token_hash ON rooms(share_token_hash);
CREATE INDEX IF NOT EXISTS idx_rooms_access_code_hash ON rooms(access_code_hash);
CREATE INDEX IF NOT EXISTS idx_rooms_management_token_hash ON rooms(management_token_hash);
CREATE INDEX IF NOT EXISTS idx_rooms_expires_at ON rooms(expires_at);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);

CREATE INDEX IF NOT EXISTS idx_files_room_id ON files(room_id);
CREATE INDEX IF NOT EXISTS idx_files_storage_key ON files(storage_key);

CREATE INDEX IF NOT EXISTS idx_cleanup_jobs_next_run_at ON cleanup_jobs(next_run_at);
CREATE INDEX IF NOT EXISTS idx_cleanup_jobs_room_id ON cleanup_jobs(room_id);

-- ==============================================================================
-- 5. Row-Level Security (RLS) Configuration
-- ==============================================================================
-- Privileged server operations use SUPABASE_SERVICE_ROLE_KEY or direct DATABASE_URL
-- (which bypasses RLS). All direct anonymous access via the public anon key is denied
-- to protect against room enumeration, timing attacks, and metadata leakage.

ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE cleanup_jobs ENABLE ROW LEVEL SECURITY;

-- Explicitly drop existing permissive policies if re-running
DROP POLICY IF EXISTS "Deny all anon select on rooms" ON rooms;
DROP POLICY IF EXISTS "Deny all anon select on files" ON files;
DROP POLICY IF EXISTS "Deny all anon select on cleanup_jobs" ON cleanup_jobs;

-- Service role full access policies
CREATE POLICY "Service role full access on rooms"
  ON rooms
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on files"
  ON files
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on cleanup_jobs"
  ON cleanup_jobs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ==============================================================================
-- 6. Supabase Storage Bucket Configuration
-- ==============================================================================
-- Private bucket for doingdrop file storage with public access disabled.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('doingdrop-files', 'doingdrop-files', false, 104857600, NULL)
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 104857600;

-- Storage RLS: Ensure only authenticated service role can access the bucket
CREATE POLICY "Service role full access to doingdrop-files"
  ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id = 'doingdrop-files')
  WITH CHECK (bucket_id = 'doingdrop-files');
