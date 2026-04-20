import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { StorageProvider, FileMetadata, StorageResult } from "./types";

function getClient(): S3Client {
  return new S3Client({
    region: process.env.AWS_REGION!,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
}

function getBucket(): string {
  const b = process.env.AWS_S3_BUCKET;
  if (!b) throw new Error("AWS_S3_BUCKET is not set");
  return b;
}

export class S3StorageProvider implements StorageProvider {
  async saveFile(buffer: Buffer, metadata: FileMetadata): Promise<StorageResult> {
    const safeName = metadata.originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `${metadata.workspaceId}/${metadata.conversationId}/${Date.now()}-${safeName}`;

    await getClient().send(
      new PutObjectCommand({
        Bucket: getBucket(),
        Key: key,
        Body: buffer,
        ContentType: metadata.mimeType,
      })
    );

    return { storagePath: key, sizeBytes: buffer.length };
  }

  async deleteFile(storagePath: string): Promise<void> {
    await getClient()
      .send(new DeleteObjectCommand({ Bucket: getBucket(), Key: storagePath }))
      .catch((err) => console.error(`S3 delete failed for ${storagePath}:`, err));
  }

  // S3 files don't have a local path — always use getFileBuffer instead
  getFilePath(_storagePath: string): string {
    throw new Error("S3StorageProvider: use getFileBuffer() instead of getFilePath()");
  }

  async getFileBuffer(storagePath: string): Promise<Buffer> {
    const res = await getClient().send(
      new GetObjectCommand({ Bucket: getBucket(), Key: storagePath })
    );
    const bytes = await (res.Body as { transformToByteArray(): Promise<Uint8Array> }).transformToByteArray();
    return Buffer.from(bytes);
  }
}
