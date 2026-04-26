"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AudioRecorder } from "@/components/conversations/audio-recorder";
import { FileUpload } from "@/components/conversations/file-upload";
import { useLabels } from "@/lib/client-language";
import { convertBlobToMp3 } from "@/lib/mp3-encoder";

type InputMode = "choose" | "record" | "upload";
type Phase = "creating" | "compressing" | "uploading" | "analyzing";

const COMPRESS_THRESHOLD_MB = 20;

function uploadWithProgress(
  url: string,
  formData: FormData,
  onProgress: (pct: number) => void
): Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      const responseText = xhr.responseText;
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        json: () => Promise.resolve(JSON.parse(responseText)),
      });
    };
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.send(formData);
  });
}

export default function NewConversationPage() {
  const router = useRouter();
  const labels = useLabels();
  const [mode, setMode] = useState<InputMode>("choose");
  const [title, setTitle] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [sourceType, setSourceType] = useState<"RECORDED" | "UPLOADED">("UPLOADED");
  const [compress, setCompress] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [phase, setPhase] = useState<Phase>("creating");
  const [compressedSize, setCompressedSize] = useState<number | null>(null);
  const [error, setError] = useState("");

  const isLargeFile = audioFile ? audioFile.size > COMPRESS_THRESHOLD_MB * 1024 * 1024 : false;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError(labels.enterTitle);
      return;
    }
    if (!audioFile) {
      setError(labels.recordOrUpload);
      return;
    }

    setError("");
    setUploading(true);
    setUploadProgress(0);
    setCompressedSize(null);
    setPhase("creating");

    try {
      const createRes = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() }),
      });

      if (!createRes.ok) {
        const data = await createRes.json();
        setError(data.error || labels.failedToCreate);
        setUploading(false);
        return;
      }

      const { conversation } = await createRes.json();

      let fileToUpload: File = audioFile;

      if (compress) {
        setPhase("compressing");
        const compressed = await convertBlobToMp3(audioFile, 64);
        setCompressedSize(compressed.size);
        fileToUpload = compressed;
      }

      const formData = new FormData();
      formData.append("file", fileToUpload);
      formData.append("sourceType", sourceType);

      setPhase("uploading");

      const uploadRes = await uploadWithProgress(
        `/api/conversations/${conversation.id}/upload`,
        formData,
        setUploadProgress
      );

      if (!uploadRes.ok) {
        const data = await uploadRes.json() as { error?: string };
        setError(data.error || labels.failedToUpload);
        setUploading(false);
        return;
      }

      // Auto-trigger analysis so the user gets a single "Analyze" button
      // instead of a two-step "Create then Analyze" flow. Whether email is
      // sent at the end is decided by Workspace.notifyOnAnalysisDone — the
      // process route reads it server-side from the workspace settings.
      setPhase("analyzing");
      const processRes = await fetch(
        `/api/conversations/${conversation.id}/process`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }
      );
      // Don't block the redirect on a process failure — the conversation page
      // shows a "retry" button if status === FAILED. Surface the error inline
      // first so the user sees it before the redirect.
      if (!processRes.ok) {
        const data = await processRes.json().catch(() => ({}));
        const msg =
          (data as { error?: string }).error || labels.somethingWentWrong;
        setError(msg);
      }

      router.push(`/dashboard/conversations/${conversation.id}`);
      router.refresh();
    } catch {
      setError(labels.somethingWentWrong);
      setUploading(false);
    }
  }

  const fileSizeMb = (audioFile?.size ?? 0) / (1024 * 1024);
  const uploadFileSizeMb = compress && compressedSize !== null
    ? compressedSize / (1024 * 1024)
    : fileSizeMb;
  const uploadedMb = (uploadFileSizeMb * uploadProgress) / 100;

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="text-sm text-muted-foreground hover:text-foreground transition"
        >
          {labels.back}
        </Link>
      </div>

      <h1 className="text-2xl font-bold mb-6">{labels.newConversationTitle}</h1>

      {error && (
        <div className="mb-4 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="title" className="block text-sm font-medium mb-1.5 text-muted-foreground">
            {labels.titleLabel}
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={labels.titlePlaceholder}
            required
            maxLength={200}
            disabled={uploading}
            className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
          />
        </div>

        {mode === "choose" && (
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => { setMode("record"); setSourceType("RECORDED"); }}
              disabled={uploading}
              className="rounded-xl border border-border bg-card/60 p-6 text-center hover:border-primary/40 hover:bg-card transition group"
            >
              <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-red-500/10 flex items-center justify-center group-hover:bg-red-500/20 transition">
                <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                </svg>
              </div>
              <div className="font-medium text-sm">{labels.recordAudio}</div>
              <div className="text-xs text-muted-foreground mt-1">{labels.useYourMicrophone}</div>
            </button>
            <button
              type="button"
              onClick={() => { setMode("upload"); setSourceType("UPLOADED"); }}
              disabled={uploading}
              className="rounded-xl border border-border bg-card/60 p-6 text-center hover:border-primary/40 hover:bg-card transition group"
            >
              <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition">
                <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
              </div>
              <div className="font-medium text-sm">{labels.uploadFile}</div>
              <div className="text-xs text-muted-foreground mt-1">{labels.supportedFormats}</div>
            </button>
          </div>
        )}

        {mode === "record" && (
          <div>
            <AudioRecorder
              onRecordingComplete={(file) => setAudioFile(file)}
              disabled={uploading}
            />
            <button
              type="button"
              onClick={() => { setMode("choose"); setAudioFile(null); }}
              className="mt-2 text-sm text-muted-foreground hover:text-foreground transition"
            >
              {labels.chooseDifferentMethod}
            </button>
          </div>
        )}

        {mode === "upload" && (
          <div>
            <FileUpload
              onFileSelected={(file) => setAudioFile(file)}
              disabled={uploading}
            />
            <button
              type="button"
              onClick={() => { setMode("choose"); setAudioFile(null); }}
              className="mt-2 text-sm text-muted-foreground hover:text-foreground transition"
            >
              {labels.chooseDifferentMethod}
            </button>
          </div>
        )}

        {/* Compress option — only for large uploaded files */}
        {audioFile && isLargeFile && mode === "upload" && !uploading && (
          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="relative mt-0.5 flex-shrink-0">
              <input
                type="checkbox"
                checked={compress}
                onChange={(e) => setCompress(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-4 h-4 rounded border border-border bg-background peer-checked:bg-primary peer-checked:border-primary transition flex items-center justify-center">
                {compress && (
                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium">כווץ לפני העלאה (מהיר יותר)</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                ממיר ל-MP3 64kbps מונו — מקטין את הקובץ בכ-50%. איכות דיבור זהה לתמלול.
                {compress && (
                  <span className="text-primary">
                    {" "}קובץ מוערך: ~{(fileSizeMb * 0.5).toFixed(0)} MB
                  </span>
                )}
              </div>
            </div>
          </label>
        )}

        {/* Upload progress bar */}
        {uploading && (
          <div className="rounded-xl border border-border bg-card/60 p-4 space-y-2">
            {phase === "creating" && (
              <div className="text-sm text-muted-foreground">יוצר שיחה...</div>
            )}
            {phase === "compressing" && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <svg className="w-4 h-4 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span>מכווץ קובץ... ({fileSizeMb.toFixed(1)} MB → ~{(fileSizeMb * 0.5).toFixed(0)} MB)</span>
                </div>
                <div className="text-xs text-muted-foreground">זה עשוי לקחת כ-30 שניות לקובצים גדולים</div>
              </div>
            )}
            {phase === "uploading" && (
              <>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>מעלה קובץ...</span>
                  <span>{uploadedMb.toFixed(1)} / {uploadFileSizeMb.toFixed(1)} MB ({uploadProgress}%)</span>
                </div>
                <div className="h-2 rounded-full bg-border overflow-hidden">
                  <div
                    className="h-full rounded-full brand-gradient transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </>
            )}
            {phase === "analyzing" && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <svg className="w-4 h-4 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>מתחיל ניתוח...</span>
              </div>
            )}
          </div>
        )}

        {audioFile && (
          <button
            type="submit"
            disabled={uploading || !title.trim()}
            className="w-full rounded-lg py-2.5 text-sm font-semibold brand-gradient text-white glow-orange transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:hover:scale-100"
          >
            {uploading
              ? phase === "creating"
                ? labels.creatingConversation
                : phase === "compressing"
                  ? "מכווץ קובץ..."
                  : phase === "analyzing"
                    ? "מתחיל ניתוח..."
                    : `מעלה... ${uploadProgress}%`
              : "נתח שיחה"}
          </button>
        )}
      </form>
    </div>
  );
}
