import { StorageDriver } from "./types";
import { SupabaseStorageDriver } from "./supabase";
import { LocalStorageDriver } from "./local";
import { env } from "../env";

let cachedDriver: StorageDriver | null = null;

export function getStorageDriver(): StorageDriver {
  if (cachedDriver) {
    return cachedDriver;
  }

  const hasSupabaseConfig = Boolean(
    env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
  );

  if (env.STORAGE_DRIVER === "supabase" && hasSupabaseConfig) {
    cachedDriver = new SupabaseStorageDriver();
  } else {
    cachedDriver = new LocalStorageDriver();
  }

  return cachedDriver;
}

export * from "./types";
