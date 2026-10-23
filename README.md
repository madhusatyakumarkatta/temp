# TempDrop — Privacy-First Temporary File Sharing Platform

> **"Upload. Share. Expire."**  
> *Collect less. Store temporarily. Delete reliably.*

TempDrop is a modern, production-oriented web platform designed for ephemeral file sharing without user accounts, sign-ups, tracking cookies, or persistent storage. Files are automatically and permanently deleted from private cloud object storage and databases upon reaching their server-enforced expiration time.

---

## Key Features

- **Zero Accounts or Profiling**: No login, registration, email collection, or behavioral tracking.
- **Strict Server-Enforced Retention**: Expiry clocks run on the server in UTC; browser countdowns are purely visual. Expired drops return HTTP 410 (Gone) immediately.
- **Direct Upload to Private Cloud Storage**: Built for Cloudflare R2 using AWS S3-compatible signed URLs, with automated fallback to local storage driver for zero-config development.
- **Unguessable Cryptographic Tokens**: 192-bit base64url share tokens and 8-character human-friendly access codes (e.g., `7K9P-M2XQ`).
- **One-Way Keyed Hashing**: Raw access codes, share tokens, and management secrets are never saved to the database. Stored as HMAC-SHA256 hashes with constant-time verification.
- **Early Deletion Control**: Creators receive an unguessable private deletion credential to wipe a drop and its storage objects at any time before expiry.
- **Dual Retrieval Paths**: Recipients can access files directly via unique link or by entering an access code.
- **ZIP Download Bundle**: Download all files in a drop packaged as a single ZIP archive on the fly.
- **Automated Cleanup Worker**: Scheduled background worker revokes expired drops, deletes S3/R2 objects, expunges database records, and retries failures with exponential backoff.
- **Brute-Force Rate Limiting**: Sliding window rate-limiting on room creation, file downloads, and access code attempts (max 5 attempts per 5 minutes).

---

## Architecture & Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS |
| **Icons** | Lucide React |
| **Backend API** | Next.js Server Route Handlers |
| **Database & ORM** | PostgreSQL via Drizzle ORM (with in-process PGlite fallback for instant local dev) |
| **Object Storage** | Cloudflare R2 (S3-compatible API via `@aws-sdk/client-s3`), with Local Storage Driver fallback |
| **Validation** | Zod |
| **Packaging** | JSZip (streamed ZIP bundles) |
| **Testing** | Vitest (15 unit & integration tests) |

---

## Quickstart (Local Development)

TempDrop includes zero-config local storage and database engines so you can run and test the complete application immediately without external cloud accounts.

### 1. Prerequisites
- Node.js v18.17+ or v20+ (tested on Node.js 24)
- npm or pnpm

### 2. Installation
```bash
git clone <repo-url> tempdrop
cd tempdrop
npm install
```

### 3. Environment Setup
```bash
cp .env.example .env.local
```
*(No edits required to run locally with automatic local storage and in-process PGlite).*

### 4. Run Automated Tests
```bash
npm test
```
All 15 security, cryptographic, expiry, and cleanup tests will execute and verify.

### 5. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Cloud Services Setup & Deployment

### 1. Cloudflare R2 (Private Object Storage)
1. Log into your [Cloudflare Dashboard](https://dash.cloudflare.com/) and navigate to **R2**.
2. Click **Create bucket** and name it (e.g. `tempdrop-files`).
3. Ensure **Public Access is DISABLED** (default).
4. Navigate to **Manage R2 API Tokens** and click **Create API token**:
   - Permissions: **Object Read & Write**
   - Bucket: select your bucket
5. Copy your:
   - Account ID
   - Access Key ID
   - Secret Access Key
6. Set in your production environment variables:
   ```env
   STORAGE_DRIVER="r2"
   R2_ACCOUNT_ID="<your-cloudflare-account-id>"
   R2_ACCESS_KEY_ID="<your-r2-access-key-id>"
   R2_SECRET_ACCESS_KEY="<your-r2-secret-access-key>"
   R2_BUCKET_NAME="tempdrop-files"
   ```

### 2. Managed PostgreSQL
TempDrop works with any PostgreSQL 14+ database (such as Neon, Supabase, Vercel Postgres, or AWS RDS).
1. Create a database instance in Neon or Supabase.
2. Copy the connection string:
   ```env
   DATABASE_URL="postgresql://user:password@ep-host.neon.tech/tempdrop?sslmode=require"
   ```
3. Push schema migrations:
   ```bash
   npx drizzle-kit push
   ```

### 3. Vercel Deployment
1. Import your repository into [Vercel](https://vercel.com).
2. Add your environment variables in the Vercel Project Settings:
   - `NEXT_PUBLIC_APP_URL`: Your custom production domain (e.g. `https://tempdrop.com`)
   - `DATABASE_URL`
   - `STORAGE_DRIVER`: `r2`
   - `R2_ACCOUNT_ID`
   - `R2_ACCESS_KEY_ID`
   - `R2_SECRET_ACCESS_KEY`
   - `R2_BUCKET_NAME`
   - `HASH_SECRET`: Generate a 32+ character random string
   - `CLEANUP_SECRET`: Generate a random key for cron invocation
3. Deploy!

---

## Scheduled Cleanup Worker Setup

TempDrop enforces expiry immediately at request time, but physical deletion of object storage and database records is handled by the automated cleanup worker.

### Endpoint
`POST /api/cron/cleanup`  
**Authentication Header**: `Authorization: Bearer <CLEANUP_SECRET>`  
(or via URL parameter: `?secret=<CLEANUP_SECRET>`)

### Option A: Vercel Cron (Recommended for Vercel)
Add a `vercel.json` file in the root directory:
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

### Option B: Cloudflare Workers Cron or GitHub Actions
Run a scheduled curl request every 10 minutes:
```bash
curl -X POST https://your-domain.com/api/cron/cleanup \
  -H "Authorization: Bearer YOUR_CLEANUP_SECRET"
```

### Option C: Crontab (on a Linux Server)
```cron
*/10 * * * * curl -s -X POST https://your-domain.com/api/cron/cleanup -H "Authorization: Bearer YOUR_CLEANUP_SECRET" > /dev/null
```

---

## Security & Privacy Controls

1. **Unguessable Entropy**:
   - Share tokens: 192 bits of cryptographic entropy (`crypto.randomBytes(24)` base64url).
   - Management tokens: 256 bits of cryptographic entropy (`crypto.randomBytes(32)`).
   - Access codes: 31^8 = ~852 billion combinations formatted as `XXXX-XXXX` with strict 5-attempt rate-limiting.
2. **Keyed Hashing**:
   - Database stores only `HMAC-SHA256(token, HASH_SECRET)`.
   - Constant-time verification (`crypto.timingSafeEqual`) prevents timing leaks.
3. **Storage Isolation**:
   - Files are stored under private paths: `drops/${roomId}/${fileId}_${sanitizedFilename}`.
   - Public bucket access is completely disabled.
   - Presigned upload URLs expire in 15 minutes.
   - Presigned download URLs are capped to `min(300s, remaining_room_lifetime)`.
4. **Filename Sanitization**:
   - Strips directory traversal (`../`, `..\`).
   - Removes control and null bytes.
   - Prevents Windows reserved names (`CON`, `PRN`, `AUX`, `NUL`).
   - Truncates oversized filenames to 200 characters while preserving extension.
5. **Rate Limiting**:
   - Room Creation: max 15 requests per 10 minutes per IP.
   - Code Verification: max 5 attempts per 5 minutes per IP.
   - Downloads: max 60 requests per minute per IP.

---

## Troubleshooting Guide

| Issue | Likely Cause | Solution |
|---|---|---|
| `Upload verification failed` | Upload was cancelled or storage credentials incorrect | Ensure files finished uploading before clicking finalize. Check R2 API token write permissions. |
| `Too many access code attempts` | Rate limit triggered | Wait 5 minutes for the sliding window to reset. |
| `This drop has expired` (HTTP 410) | Server clock passed `expiresAt` | Expected behavior: drops become completely inaccessible the second the timer elapses. |
| `Database connection error` | `DATABASE_URL` unreachable or invalid | Check network access, SSL settings (`?sslmode=require`), or leave `DATABASE_URL` unset in local dev to use PGlite. |
| `403 Forbidden` on early deletion | Incorrect management token | Ensure you are using the private creator management URL displayed on the upload confirmation screen. |

---

## License

MIT License. Built for ephemeral privacy and reliable data destruction.
