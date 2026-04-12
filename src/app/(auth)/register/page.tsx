"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useLabels } from "@/lib/client-language";

export default function RegisterPage() {
  const router = useRouter();
  const labels = useLabels();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || labels.registrationFailed);
        setLoading(false);
        return;
      }

      const signInResult = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (signInResult?.error) {
        router.push("/login?registered=true");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError(labels.somethingWentWrong);
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">{labels.createYourAccount}</h1>
      <p className="text-sm text-muted-foreground mb-6">
        {labels.startSummarizing}
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-1.5 text-muted-foreground">
            {labels.fullNameLabel}
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            minLength={2}
            maxLength={100}
            className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-1.5 text-muted-foreground">
            {labels.emailLabel}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            dir="ltr"
            maxLength={255}
            className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-1.5 text-muted-foreground">
            {labels.passwordLabel}
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            dir="ltr"
            minLength={8}
            maxLength={128}
            className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
          />
          <p className="text-xs text-muted-foreground mt-1">{labels.minPassword}</p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg py-2.5 text-sm font-semibold brand-gradient text-white glow-orange transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:hover:scale-100"
        >
          {loading ? labels.creatingAccount : labels.createAccount}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {labels.alreadyHaveAccount}{" "}
        <Link href="/login" className="font-medium text-primary hover:text-primary/80 transition">
          {labels.signIn}
        </Link>
      </p>
    </div>
  );
}
