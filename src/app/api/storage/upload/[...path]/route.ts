import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function PUT(
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
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }

    const filePath = path.join(storageDir, safeKey);
    const arrayBuffer = await req.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await fs.promises.writeFile(filePath, buffer);

    return new NextResponse(null, { status: 200 });
  } catch (err: any) {
    console.error("Local storage upload error:", err);
    return NextResponse.json({ error: "Failed to store file." }, { status: 500 });
  }
}
