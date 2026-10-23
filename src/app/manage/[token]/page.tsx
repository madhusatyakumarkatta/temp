"use client";

import React, { useState, use, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Trash2,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  Loader2,
  ShieldAlert,
} from "lucide-react";

function ManageContent({ token }: { token: string }) {
  const searchParams = useSearchParams();
  const roomIdFromQuery = searchParams.get("id") || "";

  const [roomId, setRoomId] = useState(roomIdFromQuery);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const handleDelete = async () => {
    if (!roomId) {
      setError("Room ID is required to process deletion.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ managementToken: token }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to delete drop.");
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Deletion failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 py-10 sm:py-16 px-4 sm:px-6">
      <div className="max-w-lg mx-auto">
        <div className="bg-white border border-neutral-200/90 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
          {success ? (
            <div className="text-center space-y-4 py-4">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-neutral-950">
                Drop Permanently Deleted
              </h2>
              <p className="text-xs text-neutral-600 max-w-sm mx-auto leading-relaxed">
                All associated files have been wiped from object storage, access has been revoked,
                and all metadata records have been expunged.
              </p>
              <div className="pt-4">
                <Link
                  href="/"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-neutral-900 text-white rounded-lg text-xs font-semibold hover:bg-neutral-800 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Return to TempDrop
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-2 border border-red-100">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <h1 className="text-2xl font-bold text-neutral-950 tracking-tight">
                  Early Deletion
                </h1>
                <p className="text-xs sm:text-sm text-neutral-500 max-w-sm mx-auto">
                  As the drop creator, you can permanently revoke access and wipe files immediately.
                </p>
              </div>

              <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-4 text-xs text-amber-900 flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-semibold block">Irreversible Action</span>
                  <p className="text-amber-800 leading-relaxed">
                    Once deleted, recipient links and access codes stop working immediately.
                    Underlying files in object storage cannot be recovered.
                  </p>
                </div>
              </div>

              {!roomIdFromQuery && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-700">
                    Drop ID
                  </label>
                  <input
                    type="text"
                    placeholder="Enter Drop UUID"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs font-mono"
                  />
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  {error}
                </div>
              )}

              <div className="space-y-3 pt-2">
                <label className="flex items-center gap-2.5 text-xs text-neutral-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                    className="w-4 h-4 rounded border-neutral-300 text-neutral-900 focus:ring-0 cursor-pointer"
                  />
                  <span>
                    I confirm that I want to delete this drop and all files permanently now.
                  </span>
                </label>

                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={!confirmed || loading || !roomId}
                  className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:bg-neutral-200 disabled:text-neutral-400 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Wiping Drop Files...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Permanently Delete Drop
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ManagePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const resolvedParams = use(params);
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center p-8">
          <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
        </div>
      }
    >
      <ManageContent token={resolvedParams.token} />
    </Suspense>
  );
}
