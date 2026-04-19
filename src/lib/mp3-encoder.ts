"use client";

import { Mp3Encoder } from "@breezystack/lamejs";

/**
 * Converts a recorded Blob (WebM/Opus or video WebM) into an MP3 File.
 *
 * Flow:
 * 1. Decode the blob's audio track via Web Audio API → AudioBuffer
 * 2. Encode PCM samples to MP3 using lamejs
 * 3. Wrap into a File for download
 *
 * Video WebM works too — decodeAudioData extracts only the audio track.
 *
 * @param blob   Source recording (audio/webm, video/webm, etc.)
 * @param bitrate MP3 kbps — default 128 (good balance for speech)
 */
export async function convertBlobToMp3(
  blob: Blob,
  bitrate = 128
): Promise<File> {
  const arrayBuffer = await blob.arrayBuffer();

  // Decode source audio to raw PCM
  const audioContext = new (window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext)();

  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
  await audioContext.close();

  const channels = Math.min(audioBuffer.numberOfChannels, 2); // MP3 supports max 2
  const sampleRate = audioBuffer.sampleRate;

  // lamejs expects Int16 PCM samples
  const leftChannel = floatTo16BitPCM(audioBuffer.getChannelData(0));
  const rightChannel =
    channels === 2 ? floatTo16BitPCM(audioBuffer.getChannelData(1)) : null;

  const mp3encoder = new Mp3Encoder(channels, sampleRate, bitrate);
  const mp3Data: Uint8Array[] = [];
  const blockSize = 1152; // MP3 frame size

  for (let i = 0; i < leftChannel.length; i += blockSize) {
    const leftChunk = leftChannel.subarray(i, i + blockSize);
    const mp3buf = (
      rightChannel !== null
        ? mp3encoder.encodeBuffer(
            leftChunk,
            rightChannel.subarray(i, i + blockSize)
          )
        : mp3encoder.encodeBuffer(leftChunk)
    ) as unknown as Uint8Array;

    if (mp3buf.length > 0) {
      mp3Data.push(mp3buf);
    }
  }

  const finalBuf = mp3encoder.flush() as unknown as Uint8Array;
  if (finalBuf.length > 0) {
    mp3Data.push(finalBuf);
  }

  const mp3Blob = new Blob(mp3Data as BlobPart[], { type: "audio/mpeg" });
  const fileName = `recording-${Date.now()}.mp3`;
  return new File([mp3Blob], fileName, { type: "audio/mpeg" });
}

function floatTo16BitPCM(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return output;
}

/**
 * Triggers a browser download for the given file.
 */
export function downloadFile(file: File | Blob, filename?: string) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename ?? (file instanceof File ? file.name : "download");
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
