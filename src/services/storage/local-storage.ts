import path from "path";
import fs from "fs/promises";
import { StorageProvider, FileMetadata, StorageResult } from "./types";

const UPLOAD_ROOT = path.join(process.cwd(), "uploads");

export class LocalStorageProvider implements StorageProvider {
  async saveFile(buffer: Buffer, metadata: FileMetadata): Promise<StorageResult> {
    const dir = path.join(
      UPLOAD_ROOT,
      metadata.workspaceId,
      metadata.conversationId
    );
    await fs.mkdir(dir, { recursive: true });

    // Sanitize filename: keep only safe characters
    const safeName = metadata.originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const timestamp = Date.now();
    const fileName = `${timestamp}-${safeName}`;
    const filePath = path.join(dir, fileName);

    await fs.writeFile(filePath, buffer);

    // Store relative path from uploads root
    const storagePath = path.join(
      metadata.workspaceId,
      metadata.conversationId,
      fileName
    ).replace(/\\/g, "/");

    return { storagePath, sizeBytes: buffer.length };
  }

  async deleteFile(storagePath: string): Promise<void> {
    const fullPath = path.join(UPLOAD_ROOT, storagePath);
    await fs.unlink(fullPath).catch((err) => {
      if (err.code !== "ENOENT") {
        console.error(`Failed to delete file ${storagePath}:`, err);
      }
    });
  }

  getFilePath(storagePath: string): string {
    return path.join(UPLOAD_ROOT, storagePath);
  }

  async getFileBuffer(storagePath: string): Promise<Buffer> {
    const fullPath = path.resolve(UPLOAD_ROOT, storagePath);
    // Prevent path traversal
    if (!fullPath.startsWith(path.resolve(UPLOAD_ROOT))) {
      throw new Error("Invalid storage path");
    }
    return fs.readFile(fullPath);
  }
}
