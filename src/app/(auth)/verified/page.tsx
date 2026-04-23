"use client";

import { useEffect } from "react";
import { signOut } from "next-auth/react";

export default function VerifiedPage() {
  useEffect(() => {
    // JWT still has emailVerified:false — sign out so the next login gets a fresh token
    signOut({ callbackUrl: "/login?verified=true" });
  }, []);

  return (
    <div className="text-center space-y-3">
      <div className="text-5xl mb-2">✓</div>
      <h1 className="text-xl font-bold">המייל אומת בהצלחה!</h1>
      <p className="text-sm text-muted-foreground">מעבירה אותך להתחברות...</p>
    </div>
  );
}
