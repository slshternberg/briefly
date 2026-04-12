"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useLabels } from "@/lib/client-language";

interface AudioRecorderProps {
  onRecordingComplete: (file: File) => void;
  disabled?: boolean;
}

type RecordingState = "idle" | "recording" | "recorded";

export function AudioRecorder({ onRecordingComplete, disabled }: AudioRecorderProps) {
  const labels = useLabels();
  const [state, setState] = useState<RecordingState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const startRecording = useCallback(async () => {
    setError("");
    chunks.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };

      recorder.onstop = () => {
        const baseMime = recorder.mimeType.split(";")[0].trim() || "audio/webm";
        const blob = new Blob(chunks.current, { type: baseMime });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        const ext = baseMime === "audio/ogg" ? "ogg" : "webm";
        const file = new File([blob], `recording-${Date.now()}.${ext}`, {
          type: baseMime,
        });
        onRecordingComplete(file);
        setState("recorded");
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.current = recorder;
      recorder.start(1000);
      setState("recording");
      setElapsed(0);

      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setError(labels.micDenied);
      } else {
        setError(labels.micError);
      }
    }
  }, [onRecordingComplete, labels]);

  const stopRecording = useCallback(() => {
    if (mediaRecorder.current && mediaRecorder.current.state === "recording") {
      mediaRecorder.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const resetRecording = useCallback(() => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setElapsed(0);
    setState("idle");
    chunks.current = [];
  }, [audioUrl]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <div className="rounded-xl border border-border bg-card/60 p-6">
      <h3 className="font-semibold mb-4">{labels.recordAudioTitle}</h3>

      {error && (
        <div className="mb-4 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {state === "idle" && (
        <button
          onClick={startRecording}
          disabled={disabled}
          className="flex items-center gap-2.5 px-5 py-2.5 rounded-lg bg-red-500/10 text-red-400 text-sm font-medium hover:bg-red-500/20 transition disabled:opacity-50"
        >
          <span className="w-3 h-3 rounded-full bg-red-400" />
          {labels.startRecording}
        </button>
      )}

      {state === "recording" && (
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-2.5 text-red-400 font-medium">
            <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse-record" />
            {labels.recording} {formatTime(elapsed)}
          </span>
          <button
            onClick={stopRecording}
            className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/80 transition"
          >
            {labels.stop}
          </button>
        </div>
      )}

      {state === "recorded" && audioUrl && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-green-400">
            {labels.recordingComplete} — {formatTime(elapsed)}
          </div>
          <audio controls src={audioUrl} className="w-full" />
          <button
            onClick={resetRecording}
            className="text-sm text-muted-foreground hover:text-foreground transition"
          >
            {labels.recordAgain}
          </button>
        </div>
      )}
    </div>
  );
}
