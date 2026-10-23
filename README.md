# doingdrop — Privacy-First Temporary File Sharing Platform

> **"Upload. Share. Expire."**  
> *Collect less. Store temporarily. Delete reliably.*

doingdrop is a production-oriented, anonymous web application built on **Supabase** for temporary, privacy-first file sharing. Users can share files securely via unique URLs or access codes without accounts, logins, or tracking. When a drop reaches its server-enforced expiration time, access is instantly revoked, and files are permanently purged from Supabase Storage and PostgreSQL.

---

## Architecture & Technology Stack

| Component | Platform / Technology | Purpose |
|---|---|---|
| **Frontend** | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS | Minimalist, responsive UI |
| **Hosting** | Vercel | Edge routing and serverless execution |
| **Database** | Supabase PostgreSQL with Row-Level Security (RLS) | High-speed, encrypted relational storage |
| **Object Storage** | Supabase Storage (`doingdrop-files` private bucket) | Direct signed upload & download transfers |
| **ORM** | Drizzle ORM | Type-safe PostgreSQL queries |
| **Local Fallback** | PGlite (WebAssembly Postgres) & LocalStorageDriver | Zero-config offline development & testing |
| **Validation** | Zod | Request & duration limit enforcement |
| **Packaging** | JSZip | On-the-fly streaming ZIP downloads |
| **Testing** | Vitest | 17 automated security and lifecycle tests |

---

## Key Features

1. **No User Accounts or Tracking**:
   - Zero registration, login, profiles, or cookies.
   - Files are addressed solely by unguessable cryptographic tokens or access codes.
2. **Pre-Upload Expiry Selection**:
   - Presets: 10 minutes, 1 hour, 6 hours, 24 hours (default), 3 days, 7 days, or permitted custom duration (5 min to 7 days).
   - Validated strictly on the server; expiry is computed in UTC when the upload finalizes.
3. **Private Supabase Storage**:
   - Private bucket (`doingdrop-files`) with all public read/write access disabled.
   - Uploads use server-generated signed upload URLs.
   - Downloads use short-lived signed URLs strictly bounded by remaining drop lifetime ($\le 300\text{s}$).
4. **Row-Level Security (RLS)**:
   - Tables (`rooms`, `files`, `cleanup_jobs`) have RLS enabled with default deny for anonymous and public access.
   - Privileged operations execute server-side via `SUPABASE_SERVICE_ROLE_KEY` or direct pooled `DATABASE_URL`.
5. **Cryptographic Protection**:
   - Share Tokens: 192 bits of cryptographic entropy (`crypto.randomBytes(24)` in `base64url`).
   - Access Codes: 8-character human-friendly codes (`XXXX-XXXX`) with 5-attempt rate-limiting.
   - Management Tokens: 256 bits of cryptographic entropy for creator early deletion.
   - Raw tokens are **never** stored in the database; only keyed HMAC-SHA256 hashes are persisted.
6. **Dual Retrieval & ZIP Download**:
   - Recipients can unlock files via direct URL (`/r/:token`) or by typing an access code at `/retrieve`.
   - Download individual files or download all packaged as a single ZIP archive on demand.
7. **Early Deletion**:
   - Drop creators receive a private management link (`/manage/:token`) to permanently delete drops before scheduled expiry.
8. **Automated Cleanup Worker**:
   - Identifies expired drops and abandoned upload sessions ($>1\text{h}$).
   - Immediately revokes access (HTTP 410 Gone).
   - Issues physical delete commands to the Supabase Storage API (`supabase.storage.from('doingdrop-files').remove(keys)`).
   - Removes database records and token hashes.
   - Retries transient failures with bounded exponential backoff ($2^{\text{attempts}}$ minutes).

---

## Quickstart (Local Development)

doingdrop includes zero-config local storage and in-process WebAssembly PostgreSQL drivers so that it runs immediately without external cloud accounts.

### 1. Installation
```bash
git clone <repo-url> doingdrop
cd doingdrop
npm install
```

### 2. Environment Setup
```bash
cp .env.example .env.local
```
*(No edits required to run locally with automatic local storage and in-process PGlite).*

### 3. Run Automated Tests
```bash
npm test
```
Runs 17 automated tests covering validation, rate limiting, token hashing, early deletion, abandoned upload cleanup, and idempotency.

### 4. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Supabase Cloud Setup

### 1. Create a Supabase Project
1. Log into your [Supabase Dashboard](https://supabase.com/dashboard) and click **New project**.
2. Select an organization, name your project (e.g. `doingdrop`), set a secure database password, and choose a region.

### 2. Run Database Migrations & RLS
1. In the Supabase Dashboard, navigate to the **SQL Editor**.
2. Open the file [`supabase/migrations/20261023_doingdrop_init.sql`](supabase/migrations/20261023_doingdrop_init.sql) from this repository.
3. Paste the contents into the SQL Editor and click **Run**.
   - This creates `rooms`, `files`, and `cleanup_jobs` tables.
   - Enables Row-Level Security (RLS) on all tables with explicit deny for public/anon access.
   - Configures the private `doingdrop-files` storage bucket.

### 3. Configure Environment Variables
In your Supabase Dashboard:
1. Navigate to **Project Settings > API**:
   - Copy **Project URL** $\rightarrow$ `NEXT_PUBLIC_SUPABASE_URL`
   - Copy **anon public key** $\rightarrow$ `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Copy **service_role secret** $\rightarrow$ `SUPABASE_SERVICE_ROLE_KEY` *(Server-only)*
2. Navigate to **Project Settings > Database**:
   - Copy the **Connection String (URI)** $\rightarrow$ `DATABASE_URL` (use Session mode port 5432 or Transaction pooler port 6543)
3. Generate high-entropy secrets for your environment:
   ```env
   HASH_SECRET="<generate-random-32-byte-hex-string>"
   CLEANUP_SECRET="<generate-random-cron-secret>"
   ```

---

## Deployment to Vercel

1. Push your repository to GitHub or GitLab.
2. In [Vercel](https://vercel.com), click **Add New > Project** and import your repository.
3. In **Environment Variables**, configure:
   - `NEXT_PUBLIC_APP_URL`: Your custom production domain (e.g. `https://doingdrop.com`)
   - `STORAGE_DRIVER`: `supabase`
   - `NEXT_PUBLIC_SUPABASE_URL`: `https://your-project.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: `your-anon-key`
   - `SUPABASE_SERVICE_ROLE_KEY`: `your-service-role-key`
   - `SUPABASE_STORAGE_BUCKET`: `doingdrop-files`
   - `DATABASE_URL`: `postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres?sslmode=require`
   - `HASH_SECRET`: Your 32+ character pepper secret
   - `CLEANUP_SECRET`: Your cron worker authorization secret
4. Click **Deploy**.

---

## Scheduled Cleanup Worker Configuration

The cleanup endpoint is located at `POST /api/cron/cleanup`.  
It requires authentication via `Authorization: Bearer <CLEANUP_SECRET>` or `?secret=<CLEANUP_SECRET>`.

### Option A: Vercel Cron (Recommended for Vercel)
Add a `vercel.json` file in your root directory:
```json
{
  "crons": [
    {
      "path": "/api/cron/cleanup?secret=YOUR_CLEANUP_SECRET",
      "schedule": "*/10 * * * *"
    }
  ]
}
```

### Option B: Supabase `pg_cron` & `pg_net`
In Supabase SQL Editor:
```sql
-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule cleanup every 10 minutes
SELECT cron.schedule(
  'doingdrop-cleanup',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://your-domain.com/api/cron/cleanup',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_CLEANUP_SECRET"}'::jsonb
  );
  $$
);
```

### Option C: GitHub Actions or External Ping
Trigger `POST https://your-domain.com/api/cron/cleanup` every 10 minutes from any scheduler.

---

## Privacy & Infrastructure Boundaries

doingdrop adheres to honest, transparent privacy practices:
- **Zero Profiling**: No cookies, account databases, or persistent identifiers.
- **Immediate Revocation**: The exact second `now >= expires_at`, all API endpoints return HTTP 410 (Gone).
- **Physical Destruction**: Storage objects and database rows are purged by the cleanup worker.
- **Infrastructure Retention**: While doingdrop permanently deletes data from active databases and storage buckets, cloud infrastructure providers (Supabase, AWS, Vercel) maintain routine disaster-recovery backups and network edge logs subject to standard enterprise lifecycles (typically 7–30 days).

---

## License

MIT License. Designed for privacy, security, and ephemeral data transfer.
