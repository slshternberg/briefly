import { StorageProvider } from "./types";
import { LocalStorageProvider } from "./local-storage";
import { S3StorageProvider } from "./s3-storage";

export type { StorageProvider, FileMetadata, StorageResult } from "./types";

let provider: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (!provider) {
    provider =
      process.env.STORAGE_TYPE === "s3"
        ? new S3StorageProvider()
        : new LocalStorageProvider();
  }
  return provider;
}
