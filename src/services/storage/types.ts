export interface FileMetadata {
  workspaceId: string;
  conversationId: string;
  originalName: string;
  mimeType: string;
}

export interface StorageResult {
  storagePath: string;
  sizeBytes: number;
}

export interface StorageProvider {
  saveFile(buffer: Buffer, metadata: FileMetadata): Promise<StorageResult>;
  deleteFile(storagePath: string): Promise<void>;
  getFilePath(storagePath: string): string;
  getFileBuffer(storagePath: string): Promise<Buffer>;
}
