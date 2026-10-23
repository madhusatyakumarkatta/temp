import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { StorageDriver, UploadTarget } from "./types";
import { env } from "../env";

export class R2StorageDriver implements StorageDriver {
  private client: S3Client;
  private bucket: string;

  constructor() {
    if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.R2_BUCKET_NAME) {
      throw new Error("Missing Cloudflare R2 credentials in environment variables.");
    }

    this.bucket = env.R2_BUCKET_NAME;
    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
    });
  }

  async createUploadUrl(
    key: string,
    contentType: string,
    sizeBytes: number,
    expiresInSeconds: number = 900 // 15 mins default
  ): Promise<UploadTarget> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
      ContentLength: sizeBytes,
    });

    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: Math.min(expiresInSeconds, 900),
    });

    return {
      uploadUrl,
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
    // Strictly cap presigned download URL lifetime (max 300 seconds or remaining room lifetime)
    const effectiveExpiry = Math.max(10, Math.min(maxExpiresInSeconds, 300));

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${encodeURIComponent(filename)}"`,
    });

    return getSignedUrl(this.client, command, {
      expiresIn: effectiveExpiry,
    });
  }

  async verifyObject(
    key: string,
    expectedSize?: number
  ): Promise<{ exists: boolean; sizeBytes?: number }> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      const response = await this.client.send(command);
      const sizeBytes = response.ContentLength ?? 0;

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

    const deleted: string[] = [];
    const failed: string[] = [];

    // Process in batches of 1000 (S3 limit)
    const batchSize = 1000;
    for (let i = 0; i < keys.length; i += batchSize) {
      const batch = keys.slice(i, i + batchSize);
      try {
        const command = new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: {
            Objects: batch.map((k) => ({ Key: k })),
            Quiet: false,
          },
        });

        const response = await this.client.send(command);
        if (response.Deleted) {
          deleted.push(...response.Deleted.map((d) => d.Key!).filter(Boolean));
        }
        if (response.Errors) {
          failed.push(...response.Errors.map((e) => e.Key!).filter(Boolean));
        }
      } catch (err) {
        console.error("Error in deleteObjects batch:", err);
        failed.push(...batch);
      }
    }

    return { deleted, failed };
  }

  async getFileBuffer(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const response = await this.client.send(command);
    if (!response.Body) {
      throw new Error(`File body empty for key: ${key}`);
    }

    const byteArray = await response.Body.transformToByteArray();
    return Buffer.from(byteArray);
  }
}
