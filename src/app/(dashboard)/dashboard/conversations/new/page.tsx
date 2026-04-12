"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AudioRecorder } from "@/components/conversations/audio-recorder";
import { FileUpload } from "@/components/conversations/file-upload";
import { useLabels } from "@/lib/client-language";

type InputMode = "choose" | "record" | "upload";

export default function NewConversationPage() {
  const router = useRouter();
  const labels = useLabels();
  const [mode, setMode] = useState<InputMode>("choose");
  const [title, setTitle] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [sourceType, setSourceType] = useState<"RECORDED" | "UPLOADED">("UPLOADED");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

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

      const formData = new FormData();
      formData.append("file", audioFile);
      formData.append("sourceType", sourceType);

      const uploadRes = await fetch(
        `/api/conversations/${conversation.id}/upload`,
        { method: "POST", body: formData }
      );

      if (!uploadRes.ok) {
        const data = await uploadRes.json();
        setError(data.error || labels.failedToUpload);
        setUploading(false);
        return;
      }

      router.push(`/dashboard/conversations/${conversation.id}`);
      router.refresh();
    } catch {
      setError(labels.somethingWentWrong);
      setUploading(false);
    }
  }

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

        {audioFile && (
          <button
            type="submit"
            disabled={uploading || !title.trim()}
            className="w-full rounded-lg py-2.5 text-sm font-semibold brand-gradient text-white glow-orange transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:hover:scale-100"
          >
            {uploading ? labels.creatingConversation : labels.createConversation}
          </button>
        )}
      </form>
    </div>
  );
}
