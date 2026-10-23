import React from "react";
import Link from "next/link";
import { Shield, Clock, HardDrive, Trash2, ArrowLeft, Lock } from "lucide-react";

export const metadata = {
  title: "Privacy & Deletion Policy — TempDrop",
  description:
    "How TempDrop handles file retention, cryptographic access, automatic deletion, and infrastructure boundaries.",
};

export default function PrivacyPage() {
  return (
    <div className="flex-1 py-10 sm:py-16 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-900 transition-colors mb-4"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to TempDrop
          </Link>
          <h1 className="text-3xl font-extrabold text-neutral-950 tracking-tight">
            Privacy & Deletion Policy
          </h1>
          <p className="text-sm text-neutral-500 mt-2">
            Published retention standards, storage boundaries, and operational guarantees.
          </p>
        </div>

        <div className="bg-white border border-neutral-200/90 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6 text-xs sm:text-sm text-neutral-700 leading-relaxed">
          {/* Core Principle */}
          <div className="border-l-2 border-neutral-900 pl-4 py-1">
            <h2 className="font-bold text-neutral-950 text-sm sm:text-base">
              Core Principle: Collect Less. Store Temporarily. Delete Reliably.
            </h2>
            <p className="mt-1 text-neutral-600 text-xs sm:text-sm">
              TempDrop is designed from the ground up for minimal data footprint. There are no user
              accounts, no tracking pixels, no advertising networks, and no permanent storage.
            </p>
          </div>

          {/* Section 1 */}
          <div className="space-y-2">
            <h3 className="font-semibold text-neutral-900 flex items-center gap-2">
              <Shield className="w-4 h-4 text-neutral-700" />
              1. What We Collect and What We Never Collect
            </h3>
            <ul className="list-disc pl-5 space-y-1 text-neutral-600 text-xs">
              <li><strong>No personal identities:</strong> No names, email addresses, phone numbers, or passwords.</li>
              <li><strong>No analytics cookies:</strong> No cross-site trackers or profiling beacons.</li>
              <li><strong>Only transient operational metadata:</strong> Sanitized file name, file size, MIME type, cryptographic token hashes, and expiration timestamp.</li>
            </ul>
          </div>

          {/* Section 2 */}
          <div className="space-y-2">
            <h3 className="font-semibold text-neutral-900 flex items-center gap-2">
              <Lock className="w-4 h-4 text-neutral-700" />
              2. Cryptographic Access Architecture
            </h3>
            <p className="text-neutral-600 text-xs">
              Raw access tokens, share tokens, and management credentials are <strong>never stored in plain text</strong> in our database.
              We only store keyed cryptographic HMAC-SHA256 hashes. Verification is performed using constant-time string comparisons to eliminate timing attack vectors.
            </p>
          </div>

          {/* Section 3 */}
          <div className="space-y-2">
            <h3 className="font-semibold text-neutral-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-neutral-700" />
              3. Strict Server-Side Expiry Enforcement
            </h3>
            <p className="text-neutral-600 text-xs">
              Expiration is determined strictly by the server clock in UTC. Client timestamps and browser countdowns are purely visual.
              The moment a drop reaches its expiration timestamp, all retrieval and download endpoints immediately return HTTP 410 (Gone).
              Any issued download URLs are short-lived (maximum 300 seconds) and automatically bounded so they cannot outlive the drop.
            </p>
          </div>

          {/* Section 4 */}
          <div className="space-y-2">
            <h3 className="font-semibold text-neutral-900 flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-neutral-700" />
              4. Private Cloud Object Storage
            </h3>
            <p className="text-neutral-600 text-xs">
              Files are stored in private Cloudflare R2 / S3 buckets with all public read and write access permanently disabled.
              Direct transfers happen over TLS 1.3 using narrowly scoped signed URLs. No file is accessible through predictable, permanent, or guessable public paths.
            </p>
          </div>

          {/* Section 5 */}
          <div className="space-y-2">
            <h3 className="font-semibold text-neutral-900 flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-neutral-700" />
              5. Automated Cleanup and Deletion Workflow
            </h3>
            <p className="text-neutral-600 text-xs">
              A scheduled background worker runs regularly to perform physical cleanup:
            </p>
            <ol className="list-decimal pl-5 space-y-1 text-neutral-600 text-xs">
              <li>Expired rooms and abandoned upload sessions have their access revoked immediately.</li>
              <li>All associated storage objects are permanently deleted via API commands.</li>
              <li>Database records and token hashes are deleted.</li>
              <li>Failed deletions are placed on a durable retry queue with bounded exponential backoff.</li>
            </ol>
          </div>

          {/* Section 6 */}
          <div className="space-y-2 border-t border-neutral-100 pt-4">
            <h3 className="font-semibold text-neutral-900">
              6. Honest Infrastructure Boundaries
            </h3>
            <p className="text-neutral-600 text-xs leading-relaxed">
              We do not make irresponsible marketing claims like &ldquo;zero trace&rdquo; or &ldquo;impossible to hack.&rdquo;
              While TempDrop permanently purges your files and records from active storage and databases, cloud infrastructure providers
              (such as Cloudflare, AWS, or Vercel) maintain short-term network edge logs and disaster-recovery backup snapshots according to their standard enterprise lifecycle policies.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
