"use client";

import React, { useState, useRef, useCallback } from "react";
import { UploadCloud, File as FileIcon, X, CheckCircle2, AlertCircle } from "lucide-react";
import { formatBytes } from "@/lib/format";

export interface SelectedFileItem {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  progress: number;
  status: "pending" | "uploading" | "done" | "error";
  errorMessage?: string;
}

export interface UploadCompletePayload {
  roomId: string;
  shareToken: string;
  accessCode: string;
  managementToken: string;
  expiresAt: string;
  durationSeconds: number;
  files: Array<{
    id: string;
    filename: string;
    sizeBytes: number;
    mimeType: string;
  }>;
}

interface UploadDropzoneProps {
  selectedDuration: string | number;
  onUploadComplete: (payload: UploadCompletePayload) => void;
  maxFilesCount?: number;
  maxSingleSizeMb?: number;
  maxTotalSizeMb?: number;
}

export function UploadDropzone({
  selectedDuration,
  onUploadComplete,
  maxFilesCount = 20,
  maxSingleSizeMb = 100,
  maxTotalSizeMb = 500,
}: UploadDropzoneProps) {
  const [items, setItems] = useState<SelectedFileItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState<string>("");
  const [generalError, setGeneralError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalBytes = items.reduce((acc, curr) => acc + curr.size, 0);
  const maxTotalBytes = maxTotalSizeMb * 1024 * 1024;
  const maxSingleBytes = maxSingleSizeMb * 1024 * 1024;

  const handleFilesAdded = useCallback(
    (newFiles: FileList | File[]) => {
      setGeneralError(null);
      const incoming = Array.from(newFiles);

      if (items.length + incoming.length > maxFilesCount) {
        setGeneralError(`Maximum of ${maxFilesCount} files allowed per drop.`);
        return;
      }

      const validItems: SelectedFileItem[] = [];
      let tempTotal = totalBytes;

      for (const f of incoming) {
        if (f.size > maxSingleBytes) {
          setGeneralError(
            `File "${f.name}" exceeds the maximum individual size of ${maxSingleSizeMb}MB.`
          );
          return;
        }

        if (tempTotal + f.size > maxTotalBytes) {
          setGeneralError(
            `Total drop size exceeds the maximum capacity of ${maxTotalSizeMb}MB.`
          );
          return;
        }

        tempTotal += f.size;
        validItems.push({
          id: `${f.name}-${f.size}-${Math.random().toString(36).slice(2, 7)}`,
          file: f,
          name: f.name,
          size: f.size,
          type: f.type || "application/octet-stream",
          progress: 0,
          status: "pending",
        });
      }

      setItems((prev) => [...prev, ...validItems]);
    },
    [items, totalBytes, maxFilesCount, maxSingleBytes, maxTotalBytes, maxSingleSizeMb, maxTotalSizeMb]
  );

  const removeItem = (id: string) => {
    if (isUploading) return;
    setItems((prev) => prev.filter((item) => item.id !== id));
    setGeneralError(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesAdded(e.dataTransfer.files);
    }
  };

  // Execute upload to signed URLs and complete room
  const startUpload = async () => {
    if (items.length === 0 || isUploading) return;
    setIsUploading(true);
    setGeneralError(null);
    setUploadStep("Initializing secure drop session...");

    try {
      // 1. Create upload session via POST /api/rooms
      const initRes = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          duration: selectedDuration,
          files: items.map((i) => ({
            name: i.name,
            size: i.size,
            type: i.type,
          })),
        }),
      });

      if (!initRes.ok) {
        const errData = await initRes.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to initialize upload session.");
      }

      const initData = await initRes.json();
      const { roomId, shareToken, accessCode, managementToken, files: targets } = initData;

      // 2. Upload each file directly to its signed URL
      setUploadStep("Transferring files directly to private storage...");

      for (let idx = 0; idx < targets.length; idx++) {
        const target = targets[idx];
        const item = items[idx];

        setItems((prev) =>
          prev.map((it, i) => (i === idx ? { ...it, status: "uploading", progress: 10 } : it))
        );

        // Upload using XMLHttpRequest to report progress
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open(target.method || "PUT", target.uploadUrl);

          if (target.headers) {
            for (const [key, val] of Object.entries(target.headers)) {
              xhr.setRequestHeader(key, val as string);
            }
          }

          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const percent = Math.round((event.loaded / event.total) * 100);
              setItems((prev) =>
                prev.map((it, i) => (i === idx ? { ...it, progress: percent } : it))
              );
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              setItems((prev) =>
                prev.map((it, i) =>
                  i === idx ? { ...it, progress: 100, status: "done" } : it
                )
              );
              resolve();
            } else {
              reject(new Error(`Storage error: ${xhr.status} ${xhr.statusText}`));
            }
          };

          xhr.onerror = () => {
            reject(new Error("Network error during file upload."));
          };

          xhr.send(item.file);
        });
      }

      // 3. Finalize and verify uploads via POST /api/rooms/:id/complete
      setUploadStep("Verifying uploads and activating drop...");

      const completeRes = await fetch(`/api/rooms/${roomId}/complete`, {
        method: "POST",
      });

      if (!completeRes.ok) {
        const errData = await completeRes.json().catch(() => ({}));
        throw new Error(errData.error || "Upload verification failed on server.");
      }

      const completeData = await completeRes.json();

      onUploadComplete({
        roomId,
        shareToken,
        accessCode,
        managementToken,
        expiresAt: completeData.expiresAt,
        durationSeconds: completeData.durationSeconds,
        files: targets.map((t: any) => ({
          id: t.id,
          filename: t.name,
          sizeBytes: t.size,
          mimeType: t.type,
        })),
      });
    } catch (err: any) {
      console.error("Upload error:", err);
      setGeneralError(err.message || "An unexpected error occurred during upload.");
      setIsUploading(false);
      setUploadStep("");
    }
  };

  return (
    <div className="space-y-4">
      {/* Drop area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition-all ${
          isDragging
            ? "border-neutral-900 bg-neutral-100/70 scale-[0.99]"
            : "border-neutral-300 hover:border-neutral-400 bg-white"
        } ${isUploading ? "pointer-events-none opacity-80" : "cursor-pointer"}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFilesAdded(e.target.files);
            }
          }}
        />

        <div className="mx-auto w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-700 mb-4 shadow-2xs">
          <UploadCloud className="w-6 h-6" />
        </div>

        <h3 className="text-base sm:text-lg font-semibold text-neutral-900 mb-1">
          Drag and drop files here, or <span className="underline underline-offset-4">browse</span>
        </h3>
        <p className="text-xs text-neutral-500 max-w-sm mx-auto">
          Up to {maxFilesCount} files, {maxSingleSizeMb}MB per file, {maxTotalSizeMb}MB total.
          Encrypted in transit, zero account needed.
        </p>
      </div>

      {generalError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2.5 text-xs text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{generalError}</span>
        </div>
      )}

      {/* Selected files list */}
      {items.length > 0 && (
        <div className="bg-white border border-neutral-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between text-xs text-neutral-500 border-b border-neutral-100 pb-2">
            <span className="font-medium text-neutral-800">
              Selected Files ({items.length})
            </span>
            <span>
              {formatBytes(totalBytes)} / {maxTotalSizeMb}MB
            </span>
          </div>

          <div className="max-h-60 overflow-y-auto space-y-2 pr-1 divide-y divide-neutral-100">
            {items.map((item) => (
              <div key={item.id} className="pt-2 first:pt-0 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-7 h-7 rounded bg-neutral-100 flex items-center justify-center text-neutral-500 shrink-0">
                    <FileIcon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-neutral-800 truncate">{item.name}</p>
                    <p className="text-[11px] text-neutral-400">{formatBytes(item.size)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {item.status === "uploading" && (
                    <span className="text-[11px] font-mono text-neutral-600">
                      {item.progress}%
                    </span>
                  )}
                  {item.status === "done" && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  )}
                  {!isUploading && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeItem(item.id);
                      }}
                      className="p-1 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded transition-colors"
                      title="Remove file"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {isUploading && (
            <div className="pt-2 space-y-1.5 border-t border-neutral-100">
              <div className="flex items-center justify-between text-xs text-neutral-600">
                <span>{uploadStep}</span>
              </div>
              <div className="w-full bg-neutral-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-neutral-900 h-1.5 rounded-full transition-all duration-300"
                  style={{
                    width: `${
                      items.reduce((acc, curr) => acc + curr.progress, 0) /
                      (items.length || 1)
                    }%`,
                  }}
                />
              </div>
            </div>
          )}

          {!isUploading && (
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={startUpload}
                className="w-full sm:w-auto px-6 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-sm transition-all cursor-pointer"
              >
                Upload Drop ({formatBytes(totalBytes)})
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
