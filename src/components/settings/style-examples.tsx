"use client";

import { useState, useEffect } from "react";
import { useLabels } from "@/lib/client-language";

interface StyleExample {
  id: string;
  title: string;
  sentEmailSubject: string;
  status: string;
  createdAt: string;
}

interface StyleProfileData {
  analysisPreferences: {
    summaryLength: string;
    tone: string;
    focusAreas: string[];
  };
  emailStyleProfile: {
    formality: string;
    length: string;
    openingStyle: string;
    closingStyle: string;
    structure: string;
    directness: string;
  };
  generalObservations: string;
}

export function StyleExamples({ canEdit }: { canEdit: boolean }) {
  const labels = useLabels();

  const STATUS_BADGES: Record<string, { label: string; color: string }> = {
    PENDING: { label: labels.pending, color: "bg-muted text-muted-foreground" },
    PROCESSING: { label: labels.processing, color: "bg-yellow-500/10 text-yellow-400" },
    COMPLETED: { label: labels.analyzed, color: "bg-green-500/10 text-green-400" },
    FAILED: { label: labels.failed, color: "bg-destructive/10 text-destructive" },
  };
  const [examples, setExamples] = useState<StyleExample[]>([]);
  const [profile, setProfile] = useState<StyleProfileData | null>(null);
  const [exampleCount, setExampleCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [title, setTitle] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [exRes, profRes] = await Promise.all([
        fetch("/api/workspace/style-examples"),
        fetch("/api/workspace/style-profile"),
      ]);
      if (exRes.ok) {
        const data = await exRes.json();
        setExamples(data.examples || []);
      }
      if (profRes.ok) {
        const data = await profRes.json();
        setProfile(data.profile || null);
        setExampleCount(data.exampleCount || 0);
      }
    } catch {
      // Ignore
    }
    setLoading(false);
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !title.trim() || !emailSubject.trim() || !emailBody.trim()) {
      setError(labels.allFieldsRequired);
      return;
    }

    setUploading(true);
    setError("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", title.trim());
    formData.append("sentEmailSubject", emailSubject.trim());
    formData.append("sentEmailBody", emailBody.trim());
    if (notes.trim()) formData.append("notes", notes.trim());

    try {
      const res = await fetch("/api/workspace/style-examples", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || labels.uploadFailed);
        setUploading(false);
        return;
      }

      // Reset form
      setTitle("");
      setEmailSubject("");
      setEmailBody("");
      setNotes("");
      setFile(null);
      setShowForm(false);
      await loadData();
    } catch {
      setError(labels.uploadFailed);
    }
    setUploading(false);
  }

  async function processExample(exampleId: string) {
    try {
      const res = await fetch(`/api/workspace/style-examples/${exampleId}`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || labels.processingFailed);
      }
      await loadData();
    } catch {
      setError(labels.processingFailed);
    }
  }

  async function deleteExample(exampleId: string) {
    if (!confirm(labels.confirmDelete)) return;
    try {
      await fetch(`/api/workspace/style-examples/${exampleId}`, {
        method: "DELETE",
      });
      await loadData();
    } catch {
      // Ignore
    }
  }

  async function generateProfile() {
    setGenerating(true);
    setError("");
    try {
      const res = await fetch("/api/workspace/style-profile", {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || labels.generationFailed);
        setGenerating(false);
        return;
      }
      await loadData();
    } catch {
      setError(labels.generationFailed);
    }
    setGenerating(false);
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">{labels.loading}</div>;
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Examples list */}
      {examples.length > 0 && (
        <div className="space-y-2">
          {examples.map((ex) => {
            const badge = STATUS_BADGES[ex.status] || STATUS_BADGES.PENDING;
            return (
              <div
                key={ex.id}
                className="flex items-center justify-between rounded-lg border border-border bg-background/50 p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate">{ex.title}</div>
                  <div className="text-xs text-muted-foreground truncate mt-0.5">
                    {ex.sentEmailSubject}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
                    {badge.label}
                  </span>
                  {canEdit && ex.status === "PENDING" && (
                    <button
                      onClick={() => processExample(ex.id)}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition"
                    >
                      {labels.analyze}
                    </button>
                  )}
                  {canEdit && (
                    <button
                      onClick={() => deleteExample(ex.id)}
                      className="px-2 py-1 rounded-lg text-xs text-destructive hover:bg-destructive/10 transition"
                    >
                      {labels.deleteExample}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {examples.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground/60">
          {labels.noExamplesYet}
        </p>
      )}

      {/* Add example form */}
      {canEdit && showForm && (
        <form onSubmit={handleUpload} className="space-y-3 rounded-lg border border-border bg-background/50 p-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{labels.exampleTitle}</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={labels.exampleTitlePlaceholder}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{labels.audioFile}</label>
            <input
              type="file"
              accept="audio/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary hover:file:bg-primary/20 file:transition file:cursor-pointer"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{labels.emailSubjectSent}</label>
            <input
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              placeholder={labels.emailSubjectPlaceholder}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{labels.emailBodySent}</label>
            <textarea
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              rows={5}
              placeholder={labels.emailBodyPlaceholder}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{labels.notesOptional}</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={labels.notesPlaceholder}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={uploading}
              className="px-4 py-2 rounded-lg text-sm font-semibold brand-gradient text-white glow-orange transition-all hover:scale-[1.01] disabled:opacity-50"
            >
              {uploading ? labels.uploading : labels.addExample}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground transition"
            >
              {labels.cancel}
            </button>
          </div>
        </form>
      )}

      {/* Action buttons */}
      {canEdit && !showForm && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-border hover:bg-card/50 transition"
          >
            {labels.addStyleExample}
          </button>
          {exampleCount > 0 && (
            <button
              onClick={generateProfile}
              disabled={generating}
              className="px-4 py-2 rounded-lg text-sm font-semibold brand-gradient text-white glow-orange transition-all hover:scale-[1.01] disabled:opacity-50"
            >
              {generating ? labels.generating : labels.generateStyleProfile}
            </button>
          )}
        </div>
      )}

      {/* Active Style Profile */}
      {profile && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-primary">{labels.activeStyleProfile}</h3>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-muted-foreground">{labels.summaryStyle}</span>{" "}
              <span className="font-medium">{profile.analysisPreferences.summaryLength}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{labels.tone}</span>{" "}
              <span className="font-medium">{profile.analysisPreferences.tone}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{labels.emailFormality}</span>{" "}
              <span className="font-medium">{profile.emailStyleProfile.formality}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{labels.emailLength}</span>{" "}
              <span className="font-medium">{profile.emailStyleProfile.length}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{labels.structure}</span>{" "}
              <span className="font-medium">{profile.emailStyleProfile.structure}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{labels.directness}</span>{" "}
              <span className="font-medium">{profile.emailStyleProfile.directness}</span>
            </div>
          </div>

          {profile.analysisPreferences.focusAreas.length > 0 && (
            <div className="text-xs">
              <span className="text-muted-foreground">{labels.focusAreas} </span>
              {profile.analysisPreferences.focusAreas.map((a, i) => (
                <span key={i} className="inline-block px-2 py-0.5 mr-1 mb-1 rounded-full bg-primary/10 text-primary font-medium">
                  {a}
                </span>
              ))}
            </div>
          )}

          {profile.generalObservations && (
            <div className="text-xs text-muted-foreground border-t border-border/50 pt-2 mt-2">
              {profile.generalObservations}
            </div>
          )}

          <div className="text-xs text-muted-foreground/50">
            {labels.basedOnExamples} ({exampleCount})
          </div>
        </div>
      )}
    </div>
  );
}
