"use client";

import { useState } from "react";

interface NotificationToggleProps {
  initialValue: boolean;
  isGoogleConnected: boolean;
}

export function NotificationToggle({
  initialValue,
  isGoogleConnected,
}: NotificationToggleProps) {
  const [enabled, setEnabled] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function handleToggle(next: boolean) {
    setError("");
    setSaved(false);
    setSaving(true);
    setEnabled(next); // optimistic

    try {
      const res = await fetch("/api/workspace/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notifyOnAnalysisDone: next }),
      });
      if (!res.ok) {
        // Revert on failure
        setEnabled(!next);
        const data = await res.json();
        setError(data.error || "שמירה נכשלה");
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {
      setEnabled(!next);
      setError("שמירה נכשלה");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          disabled={saving || !isGoogleConnected}
          onChange={(e) => handleToggle(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
        />
        <span className="text-sm">
          <span className="font-medium">שלח לי מייל כשניתוח מסתיים</span>
          <span className="block text-xs text-muted-foreground mt-0.5">
            {isGoogleConnected
              ? "כשהאפשרות מסומנת, מייל יישלח אוטומטית בסוף כל ניתוח שיחה."
              : "צריך לחבר חשבון Gmail (בהמשך הדף) כדי להפעיל את האפשרות הזאת."}
          </span>
        </span>
      </label>
      {saved && (
        <p className="mt-2 text-xs text-green-600">נשמר ✓</p>
      )}
      {error && (
        <p className="mt-2 text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
