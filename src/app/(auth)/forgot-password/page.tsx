"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await fetch("/api/auth/password-reset-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch {
      setError("משהו השתבש. נסי שנית.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-1">בדקי את תיבת הדואר</h1>
        <p className="text-sm text-muted-foreground mb-6">
          אם קיים חשבון עם הכתובת הזו, שלחנו לך קישור לאיפוס הסיסמה. הקישור תקף לשעה אחת.
        </p>
        <Link
          href="/login"
          className="text-sm font-medium text-primary hover:text-primary/80 transition"
        >
          &larr; חזרה להתחברות
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">שכחת סיסמה?</h1>
      <p className="text-sm text-muted-foreground mb-6">
        הכניסי את כתובת המייל שלך ונשלח לך קישור לאיפוס.
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-1.5 text-muted-foreground">
            כתובת מייל
          </label>
          <input
            id="email"
            type="email"
            required
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg py-2.5 text-sm font-semibold brand-gradient text-white glow-orange transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:hover:scale-100"
        >
          {loading ? "שולח..." : "שליחת קישור לאיפוס"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link
          href="/login"
          className="font-medium text-primary hover:text-primary/80 transition"
        >
          &larr; חזרה להתחברות
        </Link>
      </p>
    </div>
  );
}
