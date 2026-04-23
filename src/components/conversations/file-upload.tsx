"use client";

import { useState, useRef } from "react";
import { useLabels } from "@/lib/client-language";

const ACCEPTED_TYPES = ".mp3,.wav,.m4a,.webm,.ogg";
const MAX_SIZE_MB = 500;

interface FileUploadProps {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
}

export function FileUpload({ onFileSelected, disabled }: FileUploadProps) {
  const labels = useLabels();
  const [error, setError] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError("");
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(labels.fileTooLarge);
      return;
    }

    setSelectedFile(file);
    onFileSelected(file);
  }

  function formatSize(bytes: number) {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="rounded-xl border border-border bg-card/60 p-6">
      <h3 className="font-semibold mb-4">{labels.uploadAudioFile}</h3>

      {error && (
        <div className="mb-4 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        onChange={handleFileChange}
        disabled={disabled}
        className="hidden"
      />

      {!selectedFile ? (
        <button
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className="w-full border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/40 transition disabled:opacity-50"
        >
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-primary/10 flex items-center justify-center">
            <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
          </div>
          <div className="text-sm font-medium">{labels.clickToSelect}</div>
          <div className="text-xs text-muted-foreground mt-1">{labels.supportedFormatsLong}</div>
        </button>
      ) : (
        <div className="flex items-center justify-between p-3 bg-card rounded-lg border border-border">
          <div>
            <div className="text-sm font-medium truncate max-w-xs">
              {selectedFile.name}
            </div>
            <div className="text-xs text-muted-foreground">
              {formatSize(selectedFile.size)}
            </div>
          </div>
          <button
            onClick={() => {
              setSelectedFile(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
            className="text-sm text-muted-foreground hover:text-foreground transition"
          >
            {labels.change}
          </button>
        </div>
      )}
    </div>
  );
}
