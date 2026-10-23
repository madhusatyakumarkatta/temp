import { StorageDriver } from "./types";
import { R2StorageDriver } from "./r2";
import { LocalStorageDriver } from "./local";
import { env } from "../env";

let cachedDriver: StorageDriver | null = null;

export function getStorageDriver(): StorageDriver {
  if (cachedDriver) {
    return cachedDriver;
  }

  const hasR2Config = Boolean(
    env.R2_ACCOUNT_ID &&
      env.R2_ACCESS_KEY_ID &&
      env.R2_SECRET_ACCESS_KEY &&
      env.R2_BUCKET_NAME
  );

  if (env.STORAGE_DRIVER === "r2" && hasR2Config) {
    cachedDriver = new R2StorageDriver();
  } else {
    cachedDriver = new LocalStorageDriver();
  }

  return cachedDriver;
}

export * from "./types";
