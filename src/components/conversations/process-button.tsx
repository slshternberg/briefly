"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { isRTL } from "@/lib/ui-labels";

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
  isGoogleConnected: boolean;
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
  isGoogleConnected,
  labels,
}: ProcessButtonProps) {
  const router = useRouter();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [language, setLanguage] = useState(defaultLanguage);
  const [instructions, setInstructions] = useState("");
  const [showInstructions, setShowInstructions] = useState(false);
  const [sendNotification, setSendNotification] = useState(false);

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
            sendNotification: isGoogleConnected && sendNotification,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "processing_failed");
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
        <div className={`mb-3 rounded-lg p-3 text-sm border flex items-start gap-2 ${
          error === "overloaded" || error === "quota_exceeded"
            ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-300"
            : "bg-destructive/10 border-destructive/20 text-destructive"
        }`}>
          <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <div>
            {error === "overloaded" && <>
              <div className="font-medium">שרת ה-AI עמוס כרגע</div>
              <div className="text-xs mt-0.5 opacity-80">נסי שוב בעוד כמה דקות</div>
            </>}
            {error === "quota_exceeded" && <>
              <div className="font-medium">המכסה היומית של ה-AI הסתיימה</div>
              <div className="text-xs mt-0.5 opacity-80">ניתן לנסות שוב מחר או לשדרג את החשבון</div>
            </>}
            {error === "auth_error" && <>
              <div className="font-medium">בעיית הרשאות עם שירות ה-AI</div>
              <div className="text-xs mt-0.5 opacity-80">אנא פנה לתמיכה</div>
            </>}
            {error === "processing_failed" && <>
              <div className="font-medium">הניתוח נכשל</div>
              <div className="text-xs mt-0.5 opacity-80">נסי שוב, אם הבעיה חוזרת פנה לתמיכה</div>
            </>}
            {!["overloaded","quota_exceeded","auth_error","processing_failed"].includes(error) && <>
              <div className="font-medium">אירעה שגיאה</div>
              <div className="text-xs mt-0.5 opacity-80">נסי שוב מאוחר יותר</div>
            </>}
          </div>
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

      {isGoogleConnected && !isProcessing && (canProcess || isCompleted) && (
        <label className="flex items-center gap-2 mt-2 cursor-pointer w-fit">
          <input
            type="checkbox"
            checked={sendNotification}
            onChange={(e) => setSendNotification(e.target.checked)}
            className="rounded border-border accent-primary"
          />
          <span className="text-xs text-muted-foreground">
            {isRTL(defaultLanguage) ? "שלח לי מייל כשיסתיים" : "Notify me by email when done"}
          </span>
        </label>
      )}

      {isProcessing && (
        <p className="text-xs text-muted-foreground mt-2">{labels.tip}</p>
      )}
    </div>
  );
}
