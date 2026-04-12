"use client";

import { useState } from "react";
import { useLabels } from "@/lib/client-language";

const LANGUAGES = [
  { value: "Hebrew", label: "עברית (Hebrew)" },
  { value: "English", label: "English" },
  { value: "Yiddish", label: "ייִדיש (Yiddish)" },
];

interface LanguageSelectorProps {
  currentLanguage: string;
  canEdit: boolean;
}

export function LanguageSelector({ currentLanguage, canEdit }: LanguageSelectorProps) {
  const labels = useLabels();
  const [language, setLanguage] = useState(currentLanguage);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function handleChange(newLang: string) {
    setLanguage(newLang);
    setSaved(false);
    setError("");
    setSaving(true);

    try {
      const res = await fetch("/api/workspace/language", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: newLang }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || labels.failedToSave);
        setLanguage(currentLanguage);
        setSaving(false);
        return;
      }

      // Set cookie so all pages use this language
      document.cookie = `briefly_lang=${newLang}; path=/; max-age=31536000; samesite=lax`;
      setSaved(true);
      // Reload to apply language everywhere
      setTimeout(() => window.location.reload(), 500);
    } catch {
      setError(labels.failedToSave);
      setLanguage(currentLanguage);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <select
        value={language}
        onChange={(e) => handleChange(e.target.value)}
        disabled={!canEdit || saving}
        className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition disabled:opacity-50"
      >
        {LANGUAGES.map((lang) => (
          <option key={lang.value} value={lang.value}>
            {lang.label}
          </option>
        ))}
      </select>

      {saving && <span className="text-xs text-muted-foreground ms-2">{labels.saving}</span>}
      {saved && <span className="text-xs text-green-400 ms-2">{labels.saved}</span>}
      {error && <span className="text-xs text-destructive ms-2">{error}</span>}
      {!canEdit && (
        <p className="text-xs text-muted-foreground mt-1">
          {labels.onlyOwnersAdmins}
        </p>
      )}
    </div>
  );
}
