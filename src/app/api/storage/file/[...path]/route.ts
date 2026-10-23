import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params;
    if (!pathSegments || pathSegments.length === 0) {
      return NextResponse.json({ error: "Storage key required." }, { status: 400 });
    }

    const rawKey = pathSegments.join("/");
    const safeKey = rawKey.replace(/[^a-zA-Z0-9_\-\.]/g, "_");

    const storageDir = path.join(process.cwd(), ".storage_data");
    const filePath = path.join(storageDir, safeKey);

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "File not found." }, { status: 404 });
    }

    const filename = req.nextUrl.searchParams.get("name") || safeKey;
    const fileBuffer = await fs.promises.readFile(filePath);

    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
        "Content-Length": fileBuffer.byteLength.toString(),
        "Cache-Control": "private, no-cache, no-store",
      },
    });
  } catch (err: any) {
    console.error("Local storage download error:", err);
    return NextResponse.json({ error: "Failed to download file." }, { status: 500 });
  }
}
