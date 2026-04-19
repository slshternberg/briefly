"use client";

import { useEffect, useState } from "react";
import { useRecorder, type RecorderSource } from "@/hooks/use-recorder";
import { RecordingVisualizer } from "./recording-visualizer";
import { useLabels } from "@/lib/client-language";
import { convertBlobToMp3, downloadFile } from "@/lib/mp3-encoder";

interface AudioRecorderProps {
  onRecordingComplete: (file: File) => void;
  disabled?: boolean;
  maxMinutes?: number;
}

const ERROR_LABEL_MAP: Record<string, string> = {
  mic_denied: "micDenied",
  mic_not_found: "micNotFound",
  mic_in_use: "micInUse",
  mic_error: "micError",
  screen_denied: "screenDenied",
  no_system_audio: "noSystemAudio",
};

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function AudioRecorder({
  onRecordingComplete,
  disabled,
  maxMinutes = 120,
}: AudioRecorderProps) {
  const labels = useLabels();
  const recorder = useRecorder(maxMinutes * 60);
  const [mp3Busy, setMp3Busy] = useState(false);
  const [mp3Error, setMp3Error] = useState("");

  // Notify parent exactly once when recording is complete
  useEffect(() => {
    if (recorder.state === "recorded" && recorder.recordedFile) {
      onRecordingComplete(recorder.recordedFile);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder.state]);

  async function handleDownloadMp3() {
    if (!recorder.recordedFile) return;
    setMp3Busy(true);
    setMp3Error("");
    try {
      const mp3 = await convertBlobToMp3(recorder.recordedFile, 128);
      downloadFile(mp3);
    } catch (err) {
      console.error("MP3 conversion failed:", err);
      setMp3Error(labels.mp3Failed ?? "MP3 conversion failed");
    } finally {
      setMp3Busy(false);
    }
  }

  const labelKey = ERROR_LABEL_MAP[recorder.error];
  const errorMessage = labelKey
    ? (labels[labelKey as keyof typeof labels] as string)
    : "";

  return (
    <div className="rounded-xl border border-border bg-card/60 p-6">
      <h3 className="font-semibold mb-4">{labels.recordAudioTitle}</h3>

      {errorMessage && (
        <div className="mb-4 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
          {errorMessage}
          <button
            onClick={recorder.reset}
            className="ms-2 underline text-xs opacity-70 hover:opacity-100"
          >
            {labels.tryAgain}
          </button>
        </div>
      )}

      {/* IDLE — show 3 source options */}
      {recorder.state === "idle" && (
        <SourcePicker
          disabled={disabled}
          onPick={(src) => recorder.start(src)}
          labels={labels}
        />
      )}

      {/* REQUESTING */}
      {recorder.state === "requesting" && (
        <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          {recorder.source === "mic" ? labels.requestingMic : labels.requestingScreen}
        </div>
      )}

      {/* RECORDING */}
      {recorder.state === "recording" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-red-400 font-medium text-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              {sourceLabel(recorder.source, labels)} — {formatTime(recorder.elapsed)}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={recorder.pause}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-border/40 transition"
              >
                {labels.pause}
              </button>
              <button
                onClick={recorder.stop}
                className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/80 transition"
              >
                {labels.stop}
              </button>
            </div>
          </div>
          <RecordingVisualizer analyserNode={recorder.analyserNode} isActive={true} />
        </div>
      )}

      {/* PAUSED */}
      {recorder.state === "paused" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground" />
              {labels.recordingPaused} — {formatTime(recorder.elapsed)}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={recorder.resume}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-border/40 transition"
              >
                {labels.resume}
              </button>
              <button
                onClick={recorder.stop}
                className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/80 transition"
              >
                {labels.stop}
              </button>
            </div>
          </div>
          <RecordingVisualizer analyserNode={recorder.analyserNode} isActive={false} />
        </div>
      )}

      {/* RECORDED */}
      {recorder.state === "recorded" && recorder.mediaUrl && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-green-400">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            {labels.recordingComplete} — {formatTime(recorder.elapsed)}
          </div>

          {recorder.isVideo ? (
            <video
              controls
              src={recorder.mediaUrl}
              className="w-full rounded-lg bg-black max-h-80"
            />
          ) : (
            <audio controls src={recorder.mediaUrl} className="w-full" />
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleDownloadMp3}
              disabled={mp3Busy}
              className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition disabled:opacity-50"
            >
              {mp3Busy ? labels.convertingMp3 : labels.downloadMp3}
            </button>
            <button
              onClick={recorder.reset}
              className="text-sm text-muted-foreground hover:text-foreground transition"
            >
              {labels.recordAgain}
            </button>
          </div>

          {mp3Error && (
            <div className="text-xs text-destructive">{mp3Error}</div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Source picker — 3 modes
// ============================================================================

function SourcePicker({
  disabled,
  onPick,
  labels,
}: {
  disabled?: boolean;
  onPick: (src: RecorderSource) => void;
  labels: ReturnType<typeof useLabels>;
}) {
  return (
    <div className="grid gap-2.5">
      <button
        type="button"
        onClick={() => onPick("mic")}
        disabled={disabled}
        className="flex items-center gap-3 p-3 rounded-lg border border-border bg-background/40 hover:border-red-400/40 hover:bg-red-500/5 transition text-start disabled:opacity-50"
      >
        <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
          <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">{labels.sourceMicTitle}</div>
          <div className="text-xs text-muted-foreground">{labels.sourceMicDesc}</div>
        </div>
      </button>

      <button
        type="button"
        onClick={() => onPick("screen")}
        disabled={disabled}
        className="flex items-center gap-3 p-3 rounded-lg border border-border bg-background/40 hover:border-primary/40 hover:bg-primary/5 transition text-start disabled:opacity-50"
      >
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">{labels.sourceScreenTitle}</div>
          <div className="text-xs text-muted-foreground">{labels.sourceScreenDesc}</div>
        </div>
      </button>

      <button
        type="button"
        onClick={() => onPick("both")}
        disabled={disabled}
        className="flex items-center gap-3 p-3 rounded-lg border border-border bg-background/40 hover:border-orange-400/40 hover:bg-orange-500/5 transition text-start disabled:opacity-50"
      >
        <div className="w-9 h-9 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
          <svg className="w-5 h-5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">{labels.sourceBothTitle}</div>
          <div className="text-xs text-muted-foreground">{labels.sourceBothDesc}</div>
        </div>
      </button>

      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
        {labels.screenAudioHint}
      </p>
    </div>
  );
}

function sourceLabel(source: RecorderSource, labels: ReturnType<typeof useLabels>) {
  if (source === "screen") return labels.recordingScreen;
  if (source === "both") return labels.recordingBoth;
  return labels.recording;
}
