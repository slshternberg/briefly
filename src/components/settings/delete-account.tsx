"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteAccount({ userEmail }: { userEmail: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    if (confirmation !== userEmail) return;
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/account", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error || "משהו השתבש. נסי שנית.");
        return;
      }
      router.push("/login");
    } catch {
      setError("משהו השתבש. נסי שנית.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-sm text-destructive hover:text-destructive/80 font-medium transition"
      >
        מחיקת חשבון
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        פעולה זו אינה ניתנת לביטול. כל הנתונים, השיחות והסיכומים יימחקו לצמיתות.
        <br />
        הקלידי את כתובת המייל שלך כדי לאשר: <span className="font-mono text-foreground">{userEmail}</span>
      </p>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <input
        type="email"
        dir="ltr"
        value={confirmation}
        onChange={(e) => setConfirmation(e.target.value)}
        placeholder={userEmail}
        className="w-full rounded-lg border border-destructive/40 bg-background px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-destructive/30 transition"
      />

      <div className="flex gap-3">
        <button
          onClick={handleDelete}
          disabled={loading || confirmation !== userEmail}
          className="rounded-lg px-4 py-2 text-sm font-semibold bg-destructive text-destructive-foreground transition hover:bg-destructive/90 disabled:opacity-40"
        >
          {loading ? "מוחק..." : "מחיקה סופית"}
        </button>
        <button
          onClick={() => { setOpen(false); setConfirmation(""); setError(""); }}
          className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition"
        >
          ביטול
        </button>
      </div>
    </div>
  );
}
