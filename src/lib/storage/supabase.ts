import "server-only";
import { StorageDriver, UploadTarget } from "./types";
import { getSupabaseAdminClient } from "../supabase/server";
import { env } from "../env";

export class SupabaseStorageDriver implements StorageDriver {
  private bucket: string;

  constructor() {
    this.bucket = env.SUPABASE_STORAGE_BUCKET || "doingdrop-files";
  }

  async createUploadUrl(
    key: string,
    contentType: string,
    _sizeBytes: number,
    _expiresInSeconds: number = 900 // 15 mins default
  ): Promise<UploadTarget> {
    const supabase = getSupabaseAdminClient();

    const { data, error } = await supabase.storage
      .from(this.bucket)
      .createSignedUploadUrl(key);

    if (error || !data) {
      throw new Error(`Supabase Storage signed upload URL error: ${error?.message || "Unknown error"}`);
    }

    return {
      uploadUrl: data.signedUrl,
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
    maxExpiresInSeconds: number
  ): Promise<string> {
    const supabase = getSupabaseAdminClient();
    // Strictly cap presigned download URL lifetime (max 300 seconds or remaining room lifetime)
    const effectiveExpiry = Math.max(10, Math.min(maxExpiresInSeconds, 300));

    const { data, error } = await supabase.storage
      .from(this.bucket)
      .createSignedUrl(key, effectiveExpiry, {
        download: filename,
      });

    if (error || !data) {
      throw new Error(`Supabase Storage download URL error: ${error?.message || "Unknown error"}`);
    }

    return data.signedUrl;
  }

  async verifyObject(
    key: string,
    expectedSize?: number
  ): Promise<{ exists: boolean; sizeBytes?: number }> {
    try {
      const supabase = getSupabaseAdminClient();
      const segments = key.split("/");
      const fileName = segments.pop() || "";
      const folder = segments.join("/");

      const { data, error } = await supabase.storage
        .from(this.bucket)
        .list(folder, { search: fileName });

      if (error || !data) {
        return { exists: false };
      }

      const fileMatch = data.find((f) => f.name === fileName);
      if (!fileMatch) {
        return { exists: false };
      }

      const sizeBytes = (fileMatch.metadata as any)?.size ?? 0;
      if (expectedSize !== undefined && sizeBytes !== expectedSize) {
        return { exists: false, sizeBytes };
      }

      return { exists: true, sizeBytes };
    } catch {
      return { exists: false };
    }
  }

  async deleteObjects(keys: string[]): Promise<{ deleted: string[]; failed: string[] }> {
    if (keys.length === 0) {
      return { deleted: [], failed: [] };
    }

    const supabase = getSupabaseAdminClient();
    const deleted: string[] = [];
    const failed: string[] = [];

    // Supabase Storage remove takes an array of file paths
    try {
      const { data, error } = await supabase.storage.from(this.bucket).remove(keys);
      if (error) {
        console.error("Supabase Storage remove error:", error);
        failed.push(...keys);
      } else if (data) {
        const deletedKeys = data.map((d) => d.name || "").filter(Boolean);
        deleted.push(...deletedKeys);
        // Any keys not in data are marked failed
        const deletedSet = new Set(deletedKeys);
        for (const k of keys) {
          if (!deletedSet.has(k)) {
            // Check if full path was returned or just filename
            const match = deletedKeys.some((d) => k.endsWith(d));
            if (!match) failed.push(k);
          }
        }
      }
    } catch (err) {
      console.error("Exception during Supabase deleteObjects:", err);
      failed.push(...keys);
    }

    return { deleted, failed };
  }

  async getFileBuffer(key: string): Promise<Buffer> {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.storage.from(this.bucket).download(key);

    if (error || !data) {
      throw new Error(`Supabase Storage download error for key ${key}: ${error?.message || "Unknown error"}`);
    }

    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
