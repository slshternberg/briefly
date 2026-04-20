"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function JoinContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) { setStatus("error"); setError("קישור לא תקין"); return; }

    fetch("/api/workspaces/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        if (res.status === 401) {
          router.push(`/login?redirect=/join?token=${token}`);
          return;
        }
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError((data as { error?: string }).error || "משהו השתבש");
          setStatus("error");
          return;
        }
        setStatus("success");
        setTimeout(() => router.push("/dashboard"), 2000);
      })
      .catch(() => { setError("משהו השתבש"); setStatus("error"); });
  }, [token, router]);

  if (status === "loading") {
    return (
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-muted-foreground">מצטרפת לסביבת העבודה...</p>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="text-center">
        <div className="text-4xl mb-4">✓</div>
        <h1 className="text-xl font-bold mb-2">הצטרפת בהצלחה!</h1>
        <p className="text-sm text-muted-foreground">מעבירה אותך לדשבורד...</p>
      </div>
    );
  }

  return (
    <div className="text-center">
      <h1 className="text-xl font-bold mb-2">שגיאה</h1>
      <p className="text-sm text-muted-foreground mb-4">{error}</p>
      <Link href="/dashboard" className="text-sm font-medium text-primary hover:text-primary/80 transition">
        חזרה לדשבורד
      </Link>
    </div>
  );
}

export default function JoinPage() {
  return <Suspense><JoinContent /></Suspense>;
}
