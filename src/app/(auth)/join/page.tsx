"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";

function JoinContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { update } = useSession();
  const token = searchParams.get("token") ?? "";

  const [status, setStatus] = useState<"loading" | "success" | "error">(
    !token ? "error" : "loading"
  );
  const [error, setError] = useState(!token ? "קישור לא תקין" : "");

  useEffect(() => {
    if (!token) return;

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
        const data = await res.json() as { workspaceId: string; role?: string };
        // Switch session to the newly joined workspace
        await update({ activeWorkspaceId: data.workspaceId, activeWorkspaceRole: data.role ?? "MEMBER" });
        setStatus("success");
        setTimeout(() => router.push("/dashboard"), 2000);
      })
      .catch(() => { setError("משהו השתבש"); setStatus("error"); });
  }, [token, router, update]);

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
