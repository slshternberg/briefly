"use client";

import { signOut } from "next-auth/react";

export function LogoutButton({ label = "Sign out" }: { label?: string }) {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="w-full text-start text-sm text-muted-foreground hover:text-foreground transition px-3 py-1.5 rounded-lg hover:bg-sidebar-accent"
    >
      {label}
    </button>
  );
}
