"use client";

import { useState } from "react";

interface Props {
  conversationId: string;
  subject: string;
  body: string;
  isGoogleConnected: boolean;
}

export function SendEmailButton({ conversationId, subject, body, isGoogleConnected }: Props) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState("");
  const [editableSubject, setEditableSubject] = useState(subject);
  const [editableBody, setEditableBody] = useState(body);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  if (!isGoogleConnected) {
    return (
      <a
        href="/dashboard/settings"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground transition"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
        </svg>
        חבר Gmail לשליחה
      </a>
    );
  }

  async function handleSend() {
    if (!to) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch(`/api/conversations/${conversationId}/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject: editableSubject, body: editableBody }),
      });
      if (!res.ok) throw new Error();
      setSent(true);
      setOpen(false);
    } catch {
      setError("שגיאה בשליחה, נסי שוב");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-sm text-green-400">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        המייל נשלח
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg brand-gradient text-white text-sm font-medium transition hover:opacity-90"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
        </svg>
        שלח מייל ללקוח
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-2xl shadow-xl">
            <h2 className="font-semibold text-base mb-4">שלח מייל ללקוח</h2>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">נמען</label>
                <input
                  type="email"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="client@example.com"
                  dir="ltr"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">נושא</label>
                <input
                  type="text"
                  value={editableSubject}
                  onChange={(e) => setEditableSubject(e.target.value)}
                  dir="auto"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">תוכן המייל</label>
                <textarea
                  value={editableBody}
                  onChange={(e) => setEditableBody(e.target.value)}
                  dir="auto"
                  rows={12}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition resize-y"
                />
              </div>
            </div>

            {error && (
              <p className="mt-3 text-sm text-destructive">{error}</p>
            )}

            <div className="flex gap-2 mt-5">
              <button
                onClick={handleSend}
                disabled={sending || !to}
                className="flex-1 py-2 rounded-lg brand-gradient text-white text-sm font-medium disabled:opacity-50 transition hover:opacity-90"
              >
                {sending ? "שולח..." : "שלח"}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="flex-1 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground transition"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
