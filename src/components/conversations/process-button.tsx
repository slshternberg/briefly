"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const LANGUAGES = [
  { value: "Hebrew", label: "עברית" },
  { value: "English", label: "English" },
  { value: "Yiddish", label: "ייִדיש" },
  { value: "Arabic", label: "العربية" },
  { value: "Russian", label: "Русский" },
  { value: "French", label: "Français" },
  { value: "Spanish", label: "Español" },
  { value: "German", label: "Deutsch" },
];

interface ProcessButtonProps {
  conversationId: string;
  status: string;
  defaultLanguage: string;
  labels: {
    analyze: string;
    reanalyze: string;
    analyzing: string;
    retry: string;
    addInstructions: string;
    hideInstructions: string;
    instructionsPlaceholder: string;
    tip: string;
    processingFailed: string;
    somethingWentWrong: string;
  };
}

export function ProcessButton({
  conversationId,
  status,
  defaultLanguage,
  labels,
}: ProcessButtonProps) {
  const router = useRouter();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [language, setLanguage] = useState(defaultLanguage);
  const [instructions, setInstructions] = useState("");
  const [showInstructions, setShowInstructions] = useState(false);

  const canProcess = status === "UPLOADED" || status === "FAILED";
  const isCompleted = status === "COMPLETED";
  const isProcessing = status === "PROCESSING" || processing;

  async function handleProcess() {
    setError("");
    setProcessing(true);

    try {
      const res = await fetch(
        `/api/conversations/${conversationId}/process`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            outputLanguage: language,
            conversationInstructions: instructions.trim() || undefined,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || labels.processingFailed);
        setProcessing(false);
        return;
      }

      router.refresh();
    } catch {
      setError(labels.somethingWentWrong);
      setProcessing(false);
    }
  }

  function getButtonLabel() {
    if (isProcessing) return labels.analyzing;
    if (isCompleted) return labels.reanalyze;
    if (status === "FAILED") return labels.retry;
    return labels.analyze;
  }

  return (
    <div>
      {error && (
        <div className="mb-3 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          disabled={isProcessing}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition disabled:opacity-50"
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.value} value={lang.value}>
              {lang.label}
            </option>
          ))}
        </select>

        <button
          onClick={handleProcess}
          disabled={(!canProcess && !isCompleted) || isProcessing}
          className="px-5 py-2 rounded-lg text-sm font-semibold brand-gradient text-white glow-orange transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
        >
          {getButtonLabel()}
        </button>
      </div>

      {!isProcessing && (canProcess || isCompleted) && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowInstructions(!showInstructions)}
            className="text-xs text-muted-foreground hover:text-foreground transition"
          >
            {showInstructions ? labels.hideInstructions : labels.addInstructions}
          </button>

          {showInstructions && (
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              maxLength={3000}
              rows={2}
              dir="auto"
              placeholder={labels.instructionsPlaceholder}
              className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-y"
            />
          )}
        </div>
      )}

      {isProcessing && (
        <p className="text-xs text-muted-foreground mt-2">{labels.tip}</p>
      )}
    </div>
  );
}
