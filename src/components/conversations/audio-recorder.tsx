"use client";

import { useEffect, useRef, useState } from "react";
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
  const [pendingSource, setPendingSource] = useState<RecorderSource | null>(null);
  const [micDenied, setMicDenied] = useState(false);
  const permWatcherRef = useRef<PermissionStatus | null>(null);

  // Check mic permission on mount and watch for changes
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.permissions) return;
    navigator.permissions.query({ name: "microphone" as PermissionName }).then((status) => {
      setMicDenied(status.state === "denied");
      permWatcherRef.current = status;
      status.onchange = () => setMicDenied(status.state === "denied");
    }).catch(() => {});
    return () => {
      if (permWatcherRef.current) permWatcherRef.current.onchange = null;
    };
  }, []);

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

  const isDenied = micDenied || recorder.error === "mic_denied";
  const labelKey = ERROR_LABEL_MAP[recorder.error];
  const errorMessage = (!isDenied && labelKey)
    ? (labels[labelKey as keyof typeof labels] as string)
    : "";

  return (
    <div className="rounded-xl border border-border bg-card/60 p-6">
      <h3 className="font-semibold mb-4">{labels.recordAudioTitle}</h3>

      {/* Mic permission denied — visual guide */}
      {isDenied && (
        <MicPermissionGuide
          labels={labels}
          onRetry={() => { recorder.reset(); recorder.start("mic"); }}
        />
      )}

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

      {/* IDLE — show 3 source options, or a pre-share guide for screen modes */}
      {!isDenied && recorder.state === "idle" && !pendingSource && (
        <SourcePicker
          disabled={disabled}
          onPick={(src) => {
            if (src === "mic") {
              recorder.start(src);
            } else {
              setPendingSource(src);
            }
          }}
          labels={labels}
        />
      )}

      {/* Pre-share guide for screen/both modes */}
      {!isDenied && recorder.state === "idle" && pendingSource && pendingSource !== "mic" && (
        <MeetGuide
          source={pendingSource}
          labels={labels}
          onStart={() => { setPendingSource(null); recorder.start(pendingSource); }}
          onBack={() => setPendingSource(null)}
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
            {recorder.recordedFile && (
              <a
                href={recorder.mediaUrl!}
                download={recorder.recordedFile.name}
                className="px-3 py-1.5 rounded-lg bg-muted/40 text-muted-foreground text-xs font-medium hover:bg-muted/70 hover:text-foreground transition"
              >
                הורד קובץ מקורי
              </a>
            )}
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

// ============================================================================
// Mic Permission Denied — visual step-by-step guide
// ============================================================================

function MicPermissionGuide({
  labels,
  onRetry,
}: {
  labels: ReturnType<typeof useLabels>;
  onRetry: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4">
        <div className="flex items-center gap-2 mb-3">
          <svg className="w-5 h-5 text-yellow-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <span className="text-sm font-semibold text-yellow-400">
            {labels.micDeniedTitle ?? 'הגישה למיקרופון חסומה'}
          </span>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          {labels.micDeniedExplain ?? 'הדפדפן חסם גישה למיקרופון. כך מאפשרים אותה ב-Chrome:'}
        </p>

        <ol className="space-y-3">
          <li className="flex gap-3 items-start">
            <span className="shrink-0 w-6 h-6 rounded-full bg-yellow-500/20 text-yellow-400 text-xs flex items-center justify-center font-bold mt-0.5">1</span>
            <div>
              <p className="text-sm text-muted-foreground">
                {labels.micDeniedStep1 ?? 'לחצי על המנעול'}
                {' '}
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-border/60 text-xs font-mono align-middle">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                </span>
                {' '}
                {labels.micDeniedStep1b ?? 'בסרגל הכתובת (שמאל לכתובת האתר)'}
              </p>
            </div>
          </li>
          <li className="flex gap-3 items-start">
            <span className="shrink-0 w-6 h-6 rounded-full bg-yellow-500/20 text-yellow-400 text-xs flex items-center justify-center font-bold mt-0.5">2</span>
            <p className="text-sm text-muted-foreground">
              {labels.micDeniedStep2 ?? 'בחרי "הגדרות אתר" ← מצאי "מיקרופון" ← שני ל-"אפשר"'}
            </p>
          </li>
          <li className="flex gap-3 items-start">
            <span className="shrink-0 w-6 h-6 rounded-full bg-yellow-500/20 text-yellow-400 text-xs flex items-center justify-center font-bold mt-0.5">3</span>
            <p className="text-sm text-muted-foreground">
              {labels.micDeniedStep3 ?? 'חזרי לכאן ולחצי "נסה שוב" — ההקלטה תתחיל מיד'}
            </p>
          </li>
        </ol>
      </div>

      <button
        type="button"
        onClick={onRetry}
        className="w-full rounded-lg py-2.5 bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/80 transition flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
        </svg>
        {labels.micDeniedRetry ?? 'נסה שוב — אישרתי גישה למיקרופון'}
      </button>
    </div>
  );
}

// ============================================================================
// Meet Guide — shown before screen share dialog opens
// ============================================================================

function MeetGuide({
  source,
  labels,
  onStart,
  onBack,
}: {
  source: RecorderSource;
  labels: ReturnType<typeof useLabels>;
  onStart: () => void;
  onBack: () => void;
}) {
  const isBoth = source === "both";

  const steps = isBoth
    ? [
        labels.meetStep1 ?? "פתחי את Google Meet בטאב נפרד ועברי לשיחה",
        labels.meetStep2 ?? 'לחצי "התחל" — יפתח דיאלוג שיתוף מסך',
        labels.meetStep3 ?? 'בחרי "טאב" (Tab) ובחרי את טאב ה-Meet',
        labels.meetStep4 ?? '✅ סמני "שתף אודיו מהטאב" — זה חובה!',
        labels.meetStep5 ?? 'לחצי "שתף" — ואז אפשרי גישה למיקרופון',
      ]
    : [
        labels.meetStep1 ?? "פתחי את Google Meet בטאב נפרד ועברי לשיחה",
        labels.meetStep2 ?? 'לחצי "התחל" — יפתח דיאלוג שיתוף מסך',
        labels.meetStep3 ?? 'בחרי "טאב" (Tab) ובחרי את טאב ה-Meet',
        labels.meetStep4 ?? '✅ סמני "שתף אודיו מהטאב" — זה חובה!',
        labels.meetStep5Screen ?? 'לחצי "שתף"',
      ];

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
        <div className="flex items-center gap-2 mb-3">
          <svg className="w-4 h-4 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm font-medium text-primary">
            {isBoth ? (labels.meetGuideTitleBoth ?? "איך להקליט פגישה + המיקרופון שלך") : (labels.meetGuideTitleScreen ?? "איך להקליט פגישה")}
          </span>
        </div>
        <ol className="space-y-2">
          {steps.map((step, i) => (
            <li key={i} className="flex gap-2.5 text-sm">
              <span className="shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold">
                {i + 1}
              </span>
              <span className="text-muted-foreground leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>
        <div className="mt-3 p-2.5 rounded bg-yellow-500/10 border border-yellow-500/20 text-xs text-yellow-300">
          {labels.meetAudioWarning ?? '⚠️ Chrome בלבד — Safari לא תומך בשיתוף אודיו. אם אין אופציית "שתף אודיו", בחרי "טאב" ולא "חלון".'}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onStart}
          className="flex-1 rounded-lg py-2.5 bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/80 transition"
        >
          {labels.meetStartBtn ?? "הבנתי — התחל שיתוף מסך"}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground transition"
        >
          {labels.back ?? "←"}
        </button>
      </div>
    </div>
  );
}
