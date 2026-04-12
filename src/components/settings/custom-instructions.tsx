"use client";

import { useState } from "react";
import { useLabels } from "@/lib/client-language";

interface CustomInstructionsProps {
  currentInstructions: string;
  canEdit: boolean;
}

export function CustomInstructions({ currentInstructions, canEdit }: CustomInstructionsProps) {
  const labels = useLabels();
  const [instructions, setInstructions] = useState(currentInstructions);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setSaved(false);
    setError("");
    setSaving(true);

    try {
      const res = await fetch("/api/workspace/instructions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instructions }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || labels.failedToSave);
        setSaving(false);
        return;
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError(labels.failedToSave);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <textarea
        value={instructions}
        onChange={(e) => setInstructions(e.target.value)}
        disabled={!canEdit || saving}
        maxLength={5000}
        rows={4}
        dir="auto"
        placeholder={labels.instructionsSettingsPlaceholder}
        className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition disabled:opacity-50 resize-y"
      />
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-muted-foreground">
          {instructions.length}/5000
        </span>
        <div className="flex items-center gap-2">
          {saved && <span className="text-xs text-green-400">{labels.saved}</span>}
          {error && <span className="text-xs text-destructive">{error}</span>}
          <button
            onClick={handleSave}
            disabled={!canEdit || saving || instructions === currentInstructions}
            className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/80 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? labels.saving : labels.save}
          </button>
        </div>
      </div>
      {!canEdit && (
        <p className="text-xs text-muted-foreground mt-1">
          {labels.onlyOwnersAdmins}
        </p>
      )}
    </div>
  );
}
