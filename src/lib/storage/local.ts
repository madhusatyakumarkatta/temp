import fs from "fs";
import path from "path";
import { StorageDriver, UploadTarget } from "./types";
import { env } from "../env";

export class LocalStorageDriver implements StorageDriver {
  private baseDir: string;

  constructor() {
    this.baseDir = path.join(process.cwd(), ".storage_data");
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  private getFilePath(key: string): string {
    // Prevent any directory traversal in keys
    const safeKey = key.replace(/[^a-zA-Z0-9_\-\.]/g, "_");
    return path.join(this.baseDir, safeKey);
  }

  async createUploadUrl(
    key: string,
    contentType: string,
    _sizeBytes: number,
    _expiresInSeconds: number = 900
  ): Promise<UploadTarget> {
    const encodedKey = encodeURIComponent(key);
    const baseUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");

    return {
      uploadUrl: `${baseUrl}/api/storage/upload/${encodedKey}`,
      storageKey: key,
      method: "PUT",
      headers: {
        "Content-Type": contentType,
      },
    };
  }

  async createDownloadUrl(
    key: string,
    filename: string,
    _maxExpiresInSeconds: number
  ): Promise<string> {
    const encodedKey = encodeURIComponent(key);
    const encodedName = encodeURIComponent(filename);
    const baseUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");

    return `${baseUrl}/api/storage/file/${encodedKey}?name=${encodedName}`;
  }

  async verifyObject(
    key: string,
    expectedSize?: number
  ): Promise<{ exists: boolean; sizeBytes?: number }> {
    const filePath = this.getFilePath(key);
    try {
      const stat = await fs.promises.stat(filePath);
      if (expectedSize !== undefined && stat.size !== expectedSize) {
        return { exists: false, sizeBytes: stat.size };
      }
      return { exists: true, sizeBytes: stat.size };
    } catch {
      return { exists: false };
    }
  }

  async deleteObjects(keys: string[]): Promise<{ deleted: string[]; failed: string[] }> {
    const deleted: string[] = [];
    const failed: string[] = [];

    for (const key of keys) {
      const filePath = this.getFilePath(key);
      try {
        if (fs.existsSync(filePath)) {
          await fs.promises.unlink(filePath);
        }
        deleted.push(key);
      } catch (err) {
        console.error(`Failed to delete local object ${key}:`, err);
        failed.push(key);
      }
    }

    return { deleted, failed };
  }

  async getFileBuffer(key: string): Promise<Buffer> {
    const filePath = this.getFilePath(key);
    return fs.promises.readFile(filePath);
  }

  async saveFile(key: string, buffer: Buffer): Promise<void> {
    const filePath = this.getFilePath(key);
    await fs.promises.writeFile(filePath, buffer);
  }
}
