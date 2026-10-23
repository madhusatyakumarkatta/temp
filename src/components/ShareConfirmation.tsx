"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Check,
  Copy,
  Clock,
  KeyRound,
  Trash2,
  Share2,
  FileText,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { formatBytes, formatRemainingTime, formatDate } from "@/lib/format";
import { UploadCompletePayload } from "./UploadDropzone";

interface ShareConfirmationProps {
  payload: UploadCompletePayload;
  onReset: () => void;
}

export function ShareConfirmation({ payload, onReset }: ShareConfirmationProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedBoth, setCopiedBoth] = useState(false);
  const [copiedMgmt, setCopiedMgmt] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(payload.durationSeconds);

  // Live countdown timer
  useEffect(() => {
    const expiryTime = new Date(payload.expiresAt).getTime();
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((expiryTime - Date.now()) / 1000));
      setRemainingSeconds(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [payload.expiresAt]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const shareUrl = `${origin}/r/${payload.shareToken}`;
  const manageUrl = `${origin}/manage/${payload.managementToken}?id=${payload.roomId}`;

  const copyToClipboard = async (text: string, type: "link" | "code" | "both" | "mgmt") => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === "link") {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      } else if (type === "code") {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      } else if (type === "both") {
        setCopiedBoth(true);
        setTimeout(() => setCopiedBoth(false), 2000);
      } else if (type === "mgmt") {
        setCopiedMgmt(true);
        setTimeout(() => setCopiedMgmt(false), 2000);
      }
    } catch {
      // Fallback
    }
  };

  const totalBytes = payload.files.reduce((acc, f) => acc + f.sizeBytes, 0);

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Success banner */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-medium mb-2 border border-emerald-200/60">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Drop Active & Verified
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-neutral-950 tracking-tight">
              Ready to Share
            </h2>
            <p className="text-xs sm:text-sm text-neutral-500 mt-1">
              Recipients can access this drop using either the direct URL or the access code.
            </p>
          </div>

          {/* Remaining countdown badge */}
          <div className="text-right shrink-0">
            <span className="text-[11px] uppercase tracking-wider text-neutral-600 font-semibold block">
              Expires In
            </span>
            <span className="text-sm sm:text-base font-mono font-bold text-neutral-900 flex items-center justify-end gap-1 mt-0.5">
              <Clock className="w-3.5 h-3.5 text-neutral-500" />
              {formatRemainingTime(remainingSeconds)}
            </span>
          </div>
        </div>

        {/* Share URL Box */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-neutral-700 flex items-center justify-between">
            <span>Direct Share URL</span>
            <span className="text-[11px] text-neutral-600 font-normal">Method 1 of 2</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="flex-1 px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs font-mono text-neutral-800 focus:outline-hidden selection:bg-neutral-200"
            />
            <button
              type="button"
              onClick={() => copyToClipboard(shareUrl, "link")}
              className="px-3.5 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 shadow-2xs cursor-pointer"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedLink ? "Copied" : "Copy Link"}
            </button>
          </div>
        </div>

        {/* Access Code Box */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-neutral-700 flex items-center justify-between">
            <span>Access Code</span>
            <span className="text-[11px] text-neutral-600 font-normal">Method 2 of 2 (enter on doingdrop)</span>
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-lg flex items-center justify-between font-mono text-sm tracking-wider font-bold text-neutral-900">
              <span className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-neutral-400" />
                {payload.accessCode}
              </span>
            </div>
            <button
              type="button"
              onClick={() => copyToClipboard(payload.accessCode, "code")}
              className="px-3.5 py-2.5 bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedCode ? "Copied" : "Copy Code"}
            </button>
          </div>
        </div>

        {/* Share both shortcut */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() =>
              copyToClipboard(
                `doingdrop File Share\nLink: ${shareUrl}\nAccess Code: ${payload.accessCode}\nExpires: ${formatDate(payload.expiresAt)}`,
                "both"
              )
            }
            className="w-full py-2.5 border border-dashed border-neutral-300 hover:border-neutral-400 hover:bg-neutral-50/50 rounded-lg text-xs font-semibold text-neutral-700 flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            {copiedBoth ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4 text-neutral-500" />}
            {copiedBoth ? "Copied Link + Code to Clipboard" : "Copy Both (Link + Access Code)"}
          </button>
        </div>

        {/* File summary */}
        <div className="border-t border-neutral-100 pt-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span>
              Files included ({payload.files.length})
            </span>
            <span>Total size: {formatBytes(totalBytes)}</span>
          </div>
          <div className="bg-neutral-50/80 rounded-lg p-3 divide-y divide-neutral-200/60 max-h-40 overflow-y-auto">
            {payload.files.map((file) => (
              <div key={file.id} className="py-1.5 first:pt-0 last:pb-0 flex items-center justify-between text-xs">
                <span className="font-medium text-neutral-800 truncate pr-4 flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                  {file.filename}
                </span>
                <span className="text-neutral-500 shrink-0">{formatBytes(file.sizeBytes)}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-neutral-600">
            Official expiry scheduled for: <strong>{formatDate(payload.expiresAt)}</strong>
          </p>
        </div>
      </div>

      {/* Private Creator Management & Early Deletion Box */}
      <div className="bg-neutral-50 border border-neutral-200/90 rounded-2xl p-5 sm:p-6 space-y-3">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">
              Private Creator Link (Do not share with recipients)
            </h4>
            <p className="text-xs text-neutral-600 leading-relaxed">
              Save this private URL if you wish to delete this drop early before the automatic timer expires.
              Recipients only need the share link or access code above.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
          <input
            type="text"
            readOnly
            value={manageUrl}
            className="flex-1 px-3 py-2 bg-white border border-neutral-200 rounded-lg text-xs font-mono text-neutral-700 select-all"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => copyToClipboard(manageUrl, "mgmt")}
              className="flex-1 sm:flex-none px-3 py-2 bg-white border border-neutral-300 hover:bg-neutral-100 text-neutral-800 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {copiedMgmt ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedMgmt ? "Copied" : "Copy"}
            </button>
            <Link
              href={`/manage/${payload.managementToken}?id=${payload.roomId}`}
              className="flex-1 sm:flex-none px-3 py-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Manage & Delete
            </Link>
          </div>
        </div>
      </div>

      {/* Upload Another Button */}
      <div className="text-center pt-2">
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-600 hover:text-neutral-950 transition-colors cursor-pointer"
        >
          Create another drop <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
