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
  let timerId: ReturnType<typeof setTimeout> | undefined;
  try {
    const parse =
      "filePath" in input
        ? parseFile(input.filePath)
        : parseBuffer(input.buffer, input.mimeType);

    const timeout = new Promise<never>((_, reject) => {
      timerId = setTimeout(
        () => reject(new Error("Duration extraction timed out")),
        timeoutMs
      );
    });

    const metadata = await Promise.race([parse, timeout]);

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
  } finally {
    // Release the timeout handle on the success path too — Promise.race leaves
    // the loser pending, so without clearTimeout the Node event loop would
    // hold the timer until it fires, leaking roughly one handle per call.
    clearTimeout(timerId);
  }
}
