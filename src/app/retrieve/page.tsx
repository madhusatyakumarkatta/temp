"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  KeyRound,
  Download,
  Archive,
  Clock,
  FileText,
  AlertCircle,
  ShieldCheck,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { formatBytes, formatRemainingTime } from "@/lib/format";
import Link from "next/link";

interface DropFile {
  id: string;
  filename: string;
  sizeBytes: number;
  mimeType: string;
}

interface DropData {
  id: string;
  readToken: string;
  expiresAt: string;
  remainingSeconds: number;
  totalBytes: number;
  fileCount: number;
  files: DropFile[];
}

function RetrieveContent() {
  const searchParams = useSearchParams();
  const initialCode = searchParams.get("code") || "";

  const [code, setCode] = useState(initialCode);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DropData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [isZipping, setIsZipping] = useState(false);

  const handleSubmit = async (e?: React.FormEvent, codeToUse?: string) => {
    if (e) e.preventDefault();
    const targetCode = (codeToUse || code).trim().toUpperCase();
    if (!targetCode) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/rooms/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: targetCode }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          body.error || "Invalid access code, or this drop has expired."
        );
      }

      const dropData: DropData = await res.json();
      setData(dropData);
      setRemainingSeconds(dropData.remainingSeconds);
    } catch (err: any) {
      setError(err.message || "Failed to verify access code.");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialCode) {
      handleSubmit(undefined, initialCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode]);

  // Countdown timer
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

  // Download individual file using ephemeral readToken
  const handleDownloadFile = async (file: DropFile) => {
    if (!data) return;
    try {
      setDownloadingId(file.id);
      const res = await fetch(
        `/api/rooms/${encodeURIComponent(data.readToken)}/download`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileId: file.id }),
        }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to authorize download.");
      }

      const { downloadUrl } = await res.json();
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = file.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: any) {
      alert(err.message || "Download failed.");
    } finally {
      setDownloadingId(null);
    }
  };

  // Download ZIP
  const handleDownloadZip = async () => {
    if (!data) return;
    try {
      setIsZipping(true);
      const res = await fetch(
        `/api/rooms/${encodeURIComponent(data.readToken)}/zip`
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to generate ZIP archive.");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tempdrop-${data.id.slice(0, 8)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || "ZIP download failed.");
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="flex-1 py-10 sm:py-16 px-4 sm:px-6">
      <div className="max-w-xl mx-auto space-y-8">
        {/* Entry form */}
        <div className="bg-white border border-neutral-200/90 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-800 mx-auto mb-2">
              <KeyRound className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-neutral-950 tracking-tight">
              Access with Code
            </h1>
            <p className="text-xs sm:text-sm text-neutral-500 max-w-sm mx-auto">
              Enter the access code provided by the sender to retrieve your files.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="text"
                placeholder="e.g. 7K9P-M2XQ"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                disabled={loading}
                className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-center font-mono text-lg font-bold tracking-widest text-neutral-900 uppercase focus:outline-hidden focus:border-neutral-900 transition-colors"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2.5 text-xs text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="w-full py-3 bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-300 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verifying Code...
                </>
              ) : (
                "Unlock Drop Files"
              )}
            </button>
          </form>

          <p className="text-[11px] text-center text-neutral-400">
            Rate-limited to 5 verification attempts per 5 minutes to prevent brute-force attacks.
          </p>
        </div>

        {/* Retrieved Files section */}
        {data && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-medium mb-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" /> Authorized
                  </div>
                  <h3 className="text-lg font-bold text-neutral-950">
                    {data.files.length} file{data.files.length === 1 ? "" : "s"} ready
                  </h3>
                  <p className="text-xs text-neutral-400">Total {formatBytes(data.totalBytes)}</p>
                </div>

                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-neutral-400 block">
                    Expires In
                  </span>
                  <span className="text-sm font-mono font-bold text-neutral-900 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-neutral-400" />
                    {formatRemainingTime(remainingSeconds)}
                  </span>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleDownloadZip}
                  disabled={isZipping}
                  className="px-3.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {isZipping ? <Loader2 className="w-3 h-3 animate-spin" /> : <Archive className="w-3 h-3" />}
                  Download All as ZIP
                </button>
              </div>

              <div className="divide-y divide-neutral-100 border border-neutral-100 rounded-xl overflow-hidden">
                {data.files.map((file) => (
                  <div
                    key={file.id}
                    className="p-3.5 flex items-center justify-between gap-3 hover:bg-neutral-50"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <FileText className="w-4 h-4 text-neutral-400 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-neutral-900 truncate">
                          {file.filename}
                        </p>
                        <p className="text-[10px] text-neutral-400">
                          {formatBytes(file.sizeBytes)}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDownloadFile(file)}
                      disabled={downloadingId === file.id}
                      className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-medium rounded-md flex items-center gap-1 cursor-pointer"
                    >
                      {downloadingId === file.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Download className="w-3 h-3" />
                      )}
                      <span>Download</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-900 font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Homepage
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function RetrievePage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center p-8">
          <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
        </div>
      }
    >
      <RetrieveContent />
    </Suspense>
  );
}
