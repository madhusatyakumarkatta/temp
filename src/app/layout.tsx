import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "doingdrop — Privacy-First Temporary File Sharing",
  description:
    "Upload and share files temporarily without accounts or tracking. Powered by Supabase. Files expire and are permanently deleted from storage.",
  keywords: ["temporary file sharing", "private file transfer", "ephemeral storage", "no account upload", "supabase storage"],
  authors: [{ name: "doingdrop" }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#fafafa] text-neutral-900 selection:bg-neutral-900 selection:text-white">
        <header className="sticky top-0 z-50 border-b border-neutral-200/80 bg-white/80 backdrop-blur-md">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-neutral-900 text-white flex items-center justify-center font-bold text-sm tracking-tight shadow-sm transition-transform group-hover:scale-105">
                DD
              </div>
              <div>
                <span className="font-semibold text-base text-neutral-950 tracking-tight">
                  doingdrop
                </span>
                <span className="hidden sm:inline-block ml-2.5 text-xs text-neutral-600 font-normal border-l border-neutral-200 pl-2.5">
                  Upload. Share. Expire.
                </span>
              </div>
            </Link>

            <nav className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm font-medium">
              <Link
                href="/retrieve"
                className="px-3 py-1.5 rounded-md text-neutral-600 hover:text-neutral-950 hover:bg-neutral-100 transition-colors"
              >
                Access with Code
              </Link>
              <Link
                href="/privacy"
                className="px-3 py-1.5 rounded-md text-neutral-600 hover:text-neutral-950 hover:bg-neutral-100 transition-colors hidden sm:inline-block"
              >
                Privacy & Deletion
              </Link>
              <Link
                href="/"
                className="px-3.5 py-1.5 rounded-md bg-neutral-900 text-white hover:bg-neutral-800 transition-colors shadow-xs"
              >
                New Drop
              </Link>
            </nav>
          </div>
        </header>

        <main className="flex-1 flex flex-col">{children}</main>

        <footer className="border-t border-neutral-200 bg-white py-8 mt-16">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-500">
            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
              <span className="font-medium text-neutral-700">doingdrop</span>
              <span>•</span>
              <span>Collect less. Store temporarily. Delete reliably.</span>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/privacy" className="hover:text-neutral-900 transition-colors">
                Retention Policy
              </Link>
              <span>•</span>
              <Link href="/retrieve" className="hover:text-neutral-900 transition-colors">
                Retrieve Drop
              </Link>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
