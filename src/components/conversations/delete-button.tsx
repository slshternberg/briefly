"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLabels } from "@/lib/client-language";

interface DeleteButtonProps {
  conversationId: string;
}

export function DeleteButton({ conversationId }: DeleteButtonProps) {
  const router = useRouter();
  const labels = useLabels();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/conversations/${conversationId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        setDeleting(false);
        setConfirming(false);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setDeleting(false);
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-destructive">{labels.confirmDelete.split("?")[0]}?</span>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="px-2.5 py-1 rounded-md bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 transition disabled:opacity-50"
        >
          {deleting ? "..." : labels.yes}
        </button>
        <button
          onClick={() => setConfirming(false)}
          disabled={deleting}
          className="px-2.5 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground transition"
        >
          {labels.cancel}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
      title={labels.deleteConversation}
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
      </svg>
    </button>
  );
}
