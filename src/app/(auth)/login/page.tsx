"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useLabels } from "@/lib/client-language";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const labels = useLabels();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const justRegistered = searchParams.get("registered") === "true";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(labels.invalidCredentials);
        setLoading(false);
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
      <h1 className="text-2xl font-bold mb-1">{labels.welcomeBack}</h1>
      <p className="text-sm text-muted-foreground mb-6">
        {labels.signInToWorkspace}
      </p>

      {justRegistered && (
        <div className="mb-4 rounded-lg bg-green-500/10 border border-green-500/20 p-3 text-sm text-green-400">
          {labels.accountCreated}
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
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
            className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg py-2.5 text-sm font-semibold brand-gradient text-white glow-orange transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:hover:scale-100"
        >
          {loading ? labels.signingIn : labels.signIn}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {labels.noAccount}{" "}
        <Link
          href="/register"
          className="font-medium text-primary hover:text-primary/80 transition"
        >
          {labels.createAccount}
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
