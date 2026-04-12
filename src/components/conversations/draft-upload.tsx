"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useLabels } from "@/lib/client-language";

const ACCEPTED_TYPES = ".mp3,.wav,.m4a,.webm,.ogg";
const MAX_SIZE_MB = 100;

interface DraftUploadProps {
  conversationId: string;
}

export function DraftUpload({ conversationId }: DraftUploadProps) {
  const router = useRouter();
  const labels = useLabels();
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError("");
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(labels.fileTooLarge);
      return;
    }

    setFileName(file.name);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("sourceType", "UPLOADED");

      const res = await fetch(
        `/api/conversations/${conversationId}/upload`,
        { method: "POST", body: formData }
      );

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || labels.uploadFailed);
        setUploading(false);
        return;
      }

      router.refresh();
    } catch {
      setError(labels.somethingWentWrong);
      setUploading(false);
    }
  }

  return (
    <div className="rounded-xl border border-dashed border-border/60 bg-card/40 p-8 text-center">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        onChange={handleFileChange}
        disabled={uploading}
        className="hidden"
      />

      {error && (
        <div className="mb-4 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {uploading ? (
        <div className="space-y-2">
          <div className="w-8 h-8 mx-auto border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">{labels.uploading} {fileName}</p>
        </div>
      ) : (
        <>
          <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-primary/10 flex items-center justify-center">
            <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
          </div>
          <p className="text-sm font-medium mb-1">{labels.uploadToAnalyzeAction}</p>
          <p className="text-xs text-muted-foreground mb-4">{labels.supportedFormatsLong}</p>
          <button
            onClick={() => inputRef.current?.click()}
            className="px-5 py-2 rounded-lg text-sm font-semibold brand-gradient text-white glow-orange transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            {labels.chooseFile}
          </button>
        </>
      )}
    </div>
  );
}
