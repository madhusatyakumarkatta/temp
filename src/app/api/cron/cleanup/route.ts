import { NextRequest, NextResponse } from "next/server";
import { runCleanupWorker } from "@/lib/cleanup";
import { env } from "@/lib/env";
import { timingSafeMatch, hashToken } from "@/lib/crypto";

export async function POST(req: NextRequest) {
  try {
    // Authenticate worker: check Authorization: Bearer <CLEANUP_SECRET> or ?secret=<CLEANUP_SECRET>
    const authHeader = req.headers.get("authorization");
    const searchParams = req.nextUrl.searchParams;
    const querySecret = searchParams.get("secret");

    let providedSecret = "";
    if (authHeader && authHeader.startsWith("Bearer ")) {
      providedSecret = authHeader.slice(7).trim();
    } else if (querySecret) {
      providedSecret = querySecret.trim();
    }

    if (!providedSecret) {
      return NextResponse.json({ error: "Unauthorized. Secret required." }, { status: 401 });
    }

    // Compare hash with timing safe match
    const providedHash = hashToken(providedSecret);
    const expectedHash = hashToken(env.CLEANUP_SECRET);

    if (!timingSafeMatch(providedHash, expectedHash)) {
      return NextResponse.json({ error: "Forbidden. Invalid secret." }, { status: 403 });
    }

    const summary = await runCleanupWorker();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary,
    });
  } catch (error: any) {
    console.error("Error executing cleanup cron job:", error);
    return NextResponse.json(
      { error: "Cleanup worker encountered an error." },
      { status: 500 }
    );
  }
}

// Support GET for simple cron triggers (e.g. Vercel Cron or simple monitoring curls)
export async function GET(req: NextRequest) {
  return POST(req);
}
