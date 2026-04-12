import { StorageProvider } from "./types";
import { LocalStorageProvider } from "./local-storage";

export type { StorageProvider, FileMetadata, StorageResult } from "./types";

// Factory: swap this for S3StorageProvider in production
let provider: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (!provider) {
    provider = new LocalStorageProvider();
  }
  return provider;
}
