export interface UploadTarget {
  uploadUrl: string;
  storageKey: string;
  method: "PUT" | "POST";
  headers?: Record<string, string>;
}

export interface StorageDriver {
  /**
   * Generate an upload target (presigned URL or upload endpoint)
   */
  createUploadUrl(
    key: string,
    contentType: string,
    sizeBytes: number,
    expiresInSeconds?: number
  ): Promise<UploadTarget>;

  /**
   * Generate a signed or proxied download URL with strictly bounded TTL
   */
  createDownloadUrl(
    key: string,
    filename: string,
    maxExpiresInSeconds: number
  ): Promise<string>;

  /**
   * Verify that an object was uploaded successfully and matches expected size
   */
  verifyObject(
    key: string,
    expectedSize?: number
  ): Promise<{ exists: boolean; sizeBytes?: number }>;

  /**
   * Permanently delete objects from storage
   */
  deleteObjects(keys: string[]): Promise<{ deleted: string[]; failed: string[] }>;

  /**
   * Get object stream or buffer for ZIP generation or proxy download
   */
  getFileBuffer(key: string): Promise<Buffer>;
}
