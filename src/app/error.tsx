"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="text-center">
        <p className="text-6xl font-bold text-destructive mb-4">500</p>
        <h1 className="text-2xl font-bold mb-2">משהו השתבש</h1>
        <p className="text-muted-foreground mb-8">
          אירעה שגיאה בלתי צפויה. נסי שנית.
        </p>
        <button
          onClick={reset}
          className="rounded-lg px-5 py-2.5 text-sm font-semibold brand-gradient text-white glow-orange transition-all hover:scale-[1.01]"
        >
          נסה שנית
        </button>
      </div>
    </div>
  );
}
