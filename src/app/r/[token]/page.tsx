"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  Download,
  Archive,
  Clock,
  FileText,
  AlertCircle,
  ShieldCheck,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { formatBytes, formatRemainingTime, formatDate } from "@/lib/format";

interface DropFile {
  id: string;
  filename: string;
  sizeBytes: number;
  mimeType: string;
}

interface DropData {
  id: string;
  expiresAt: string;
  remainingSeconds: number;
  totalBytes: number;
  fileCount: number;
  files: DropFile[];
}

export default function RoomRetrievalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const resolvedParams = use(params);
  const token = resolvedParams.token;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DropData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [isZipping, setIsZipping] = useState(false);

  useEffect(() => {
    async function fetchDrop() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/rooms/${encodeURIComponent(token)}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            body.error || "This drop does not exist or has already expired."
          );
        }

        const dropData: DropData = await res.json();
        setData(dropData);
        setRemainingSeconds(dropData.remainingSeconds);
      } catch (err: any) {
        setError(err.message || "Failed to load drop files.");
      } finally {
        setLoading(false);
      }
    }

    if (token) {
      fetchDrop();
    }
  }, [token]);

  // Live countdown
  useEffect(() => {
    if (!data) return;

    const expiryMs = new Date(data.expiresAt).getTime();
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((expiryMs - Date.now()) / 1000));
      setRemainingSeconds(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        setError("This drop has expired and is no longer accessible.");
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [data]);

  // Download individual file via authorized signed URL
  const handleDownloadFile = async (file: DropFile) => {
    try {
      setDownloadingId(file.id);
      const res = await fetch(`/api/rooms/${encodeURIComponent(token)}/download`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: file.id }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to authorize file download.");
      }

      const { downloadUrl } = await res.json();

      // Trigger browser download
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = file.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: any) {
      alert(err.message || "Could not download file.");
    } finally {
      setDownloadingId(null);
    }
  };

  // Download all files packaged as ZIP
  const handleDownloadZip = async () => {
    try {
      setIsZipping(true);
      const res = await fetch(`/api/rooms/${encodeURIComponent(token)}/zip`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to generate ZIP archive.");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tempdrop-${data?.id.slice(0, 8) || "files"}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || "Could not download ZIP archive.");
    } finally {
      setIsZipping(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-neutral-400 mb-3" />
        <p className="text-sm font-medium text-neutral-700">Verifying drop availability...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-white border border-neutral-200 rounded-2xl p-8 shadow-xs space-y-4">
          <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 mx-auto">
            <AlertCircle className="w-6 h-6 text-neutral-600" />
          </div>
          <h2 className="text-xl font-bold text-neutral-900">Drop Unavailable</h2>
          <p className="text-xs text-neutral-500 leading-relaxed">
            {error || "This drop has expired, been deleted, or does not exist."}
            <br />
            TempDrop automatically wipes expired files from storage to protect privacy.
          </p>
          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-neutral-900 text-white rounded-lg text-xs font-semibold hover:bg-neutral-800 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to TempDrop
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 py-10 sm:py-16 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header card */}
        <div className="bg-white border border-neutral-200/90 rounded-2xl p-6 sm:p-8 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-100 pb-5">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-medium mb-2 border border-emerald-200/60">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Verified Active Drop
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-neutral-950 tracking-tight">
                Shared Files
              </h1>
              <p className="text-xs text-neutral-500 mt-0.5">
                {data.files.length} file{data.files.length === 1 ? "" : "s"} • {formatBytes(data.totalBytes)} total
              </p>
            </div>

            {/* Countdown Badge */}
            <div className="bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-right sm:text-right">
              <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-600 block">
                Time Remaining
              </span>
              <span className="text-base sm:text-lg font-mono font-bold text-neutral-900 flex items-center justify-end gap-1.5">
                <Clock className="w-4 h-4 text-neutral-500" />
                {formatRemainingTime(remainingSeconds)}
              </span>
            </div>
          </div>

          {/* Download all action */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-neutral-500">
              Expires {formatDate(data.expiresAt)}
            </span>
            <button
              type="button"
              onClick={handleDownloadZip}
              disabled={isZipping}
              className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-400 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer shadow-2xs"
            >
              {isZipping ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Generating ZIP...
                </>
              ) : (
                <>
                  <Archive className="w-3.5 h-3.5" />
                  Download All as ZIP
                </>
              )}
            </button>
          </div>
        </div>

        {/* Files list */}
        <div className="bg-white border border-neutral-200 rounded-2xl divide-y divide-neutral-100 shadow-xs overflow-hidden">
          {data.files.map((file) => (
            <div
              key={file.id}
              className="p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-neutral-50/50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-9 h-9 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-600 shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs sm:text-sm font-semibold text-neutral-900 truncate">
                    {file.filename}
                  </h4>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    {formatBytes(file.sizeBytes)} • {file.mimeType}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleDownloadFile(file)}
                disabled={downloadingId === file.id}
                className="px-3.5 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-900 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
              >
                {downloadingId === file.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span>Download</span>
              </button>
            </div>
          ))}
        </div>

        {/* Security and cleanup notice */}
        <div className="text-center text-xs text-neutral-600 space-y-1">
          <p>
            No copies or logs are preserved after the expiration timestamp.
          </p>
          <Link href="/" className="text-neutral-600 hover:text-neutral-900 underline">
            Need to send files? Upload a drop
          </Link>
        </div>
      </div>
    </div>
  );
}
