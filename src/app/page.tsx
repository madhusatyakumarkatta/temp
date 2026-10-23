"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ExpirySelector } from "@/components/ExpirySelector";
import { UploadDropzone, UploadCompletePayload } from "@/components/UploadDropzone";
import { ShareConfirmation } from "@/components/ShareConfirmation";
import { Shield, Clock, Flame, ArrowRight, KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const [selectedDuration, setSelectedDuration] = useState<string | number>("24h");
  const [uploadResult, setUploadResult] = useState<UploadCompletePayload | null>(null);
  const [quickCode, setQuickCode] = useState("");
  const router = useRouter();

  const handleQuickCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = quickCode.trim().toUpperCase();
    if (cleanCode) {
      router.push(`/retrieve?code=${encodeURIComponent(cleanCode)}`);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-center py-10 sm:py-16 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto w-full space-y-10">
        {/* Hero Section */}
        {!uploadResult && (
          <div className="text-center space-y-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-100 border border-neutral-200 text-neutral-800 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-neutral-900 animate-pulse" />
              Privacy-First Ephemeral Sharing
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold text-neutral-950 tracking-tight leading-tight">
              Your files. Your timer. <br className="hidden sm:inline" />
              No account.
            </h1>

            <p className="text-sm sm:text-base text-neutral-600 max-w-lg mx-auto leading-relaxed">
              Choose when access ends. We&apos;ll handle the cleanup. Files become inaccessible
              at expiry and are automatically wiped from cloud storage.
            </p>
          </div>
        )}

        {/* Upload Container or Share Confirmation */}
        {uploadResult ? (
          <ShareConfirmation
            payload={uploadResult}
            onReset={() => setUploadResult(null)}
          />
        ) : (
          <div className="bg-white border border-neutral-200/90 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
            {/* Expiry Selector */}
            <ExpirySelector
              selectedDuration={selectedDuration}
              onChange={setSelectedDuration}
            />

            {/* Drag & Drop Area */}
            <UploadDropzone
              selectedDuration={selectedDuration}
              onUploadComplete={(result) => setUploadResult(result)}
            />

            {/* Privacy highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-neutral-100 text-xs text-neutral-600">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-neutral-700 shrink-0" />
                <span>Zero account, cookies, or tracking</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-neutral-700 shrink-0" />
                <span>Server-enforced UTC expiry clock</span>
              </div>
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-neutral-700 shrink-0" />
                <span>Automatic multi-region physical deletion</span>
              </div>
            </div>
          </div>
        )}

        {/* Quick code access card */}
        {!uploadResult && (
          <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-neutral-200/80 flex items-center justify-center text-neutral-700 shrink-0">
                <KeyRound className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-neutral-900">Have an access code?</h4>
                <p className="text-xs text-neutral-500">
                  Recipient without the link? Enter your 8-character access code here.
                </p>
              </div>
            </div>

            <form onSubmit={handleQuickCodeSubmit} className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="text"
                placeholder="e.g. 7K9P-M2XQ"
                value={quickCode}
                onChange={(e) => setQuickCode(e.target.value.toUpperCase())}
                className="w-full sm:w-36 px-3 py-1.5 bg-white border border-neutral-300 rounded-lg text-xs font-mono uppercase text-center focus:outline-hidden"
              />
              <button
                type="submit"
                className="px-3.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg text-xs font-semibold shrink-0 transition-colors shadow-2xs cursor-pointer"
              >
                Retrieve
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
