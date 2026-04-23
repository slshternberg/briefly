"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

export default function VerifyEmailPage() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function handleResend() {
    setStatus("sending");
    try {
      // We don't have the email client-side without a session fetch,
      // so we call a dedicated endpoint that reads the session server-side
      const res = await fetch("/api/auth/resend-verification-session", { method: "POST" });
      if (!res.ok) throw new Error();
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="text-center space-y-4">
      <div className="text-5xl mb-2">📧</div>
      <h1 className="text-2xl font-bold">אמתי את כתובת המייל שלך</h1>
      <p className="text-sm text-muted-foreground leading-relaxed">
        שלחנו לך קישור אימות למייל שלך.
        <br />
        לחצי על הקישור כדי להמשיך להשתמש ב-Briefly.
      </p>

      {status === "sent" && (
        <p className="text-sm text-green-400">מייל אימות נשלח מחדש!</p>
      )}
      {status === "error" && (
        <p className="text-sm text-destructive">משהו השתבש. נסי שנית.</p>
      )}

      <div className="flex flex-col gap-2 pt-2">
        <button
          onClick={handleResend}
          disabled={status === "sending" || status === "sent"}
          className="w-full py-2.5 rounded-xl text-sm font-semibold brand-gradient text-white glow-orange transition-all hover:scale-[1.01] disabled:opacity-50"
        >
          {status === "sending" ? "שולח..." : "שלחי מחדש את קישור האימות"}
        </button>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full py-2.5 rounded-xl text-sm font-semibold border border-border bg-background hover:bg-muted/40 transition"
        >
          התנתקות
        </button>
      </div>
    </div>
  );
}
