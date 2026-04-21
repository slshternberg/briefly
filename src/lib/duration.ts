import { parseBuffer, parseFile } from "music-metadata";

const WARN_THRESHOLD_SECONDS = 24 * 3600;

/**
 * Extract audio duration from a local file path or an in-memory buffer.
 * Returns seconds (rounded), or null if the file is invalid/unreadable.
 * Never throws.
 *
 * @param input  { filePath } for local storage, { buffer, mimeType } for S3 or in-memory
 * @param timeoutMs  abort if music-metadata hangs (default 5s; use 2s in upload path)
 */
export async function extractDurationSeconds(
  input: { filePath: string } | { buffer: Buffer; mimeType: string },
  timeoutMs = 5000
): Promise<number | null> {
  try {
    const parse =
      "filePath" in input
        ? parseFile(input.filePath)
        : parseBuffer(input.buffer, input.mimeType);

    const metadata = await Promise.race([
      parse,
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("Duration extraction timed out")),
          timeoutMs
        )
      ),
    ]);

    const raw = metadata.format.duration;

    if (raw == null || raw === 0 || !Number.isFinite(raw)) return null;
    if (raw < 1) return 1; // round up legitimate sub-second recordings

    const seconds = Math.round(raw);

    if (seconds > WARN_THRESHOLD_SECONDS) {
      const id =
        "filePath" in input
          ? input.filePath
          : `buffer(${input.buffer.length} bytes)`;
      console.warn(`[duration] Unusually long audio: ${seconds}s for ${id}`);
    }

    return seconds;
  } catch (err) {
    const id = "filePath" in input ? input.filePath : "buffer";
    console.warn(
      `[duration] Failed to extract duration for ${id}:`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}
