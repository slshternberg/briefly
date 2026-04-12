"use client";

import { useState, useRef, useEffect } from "react";
import { useLabels } from "@/lib/client-language";

interface EditableTitleProps {
  conversationId: string;
  initialTitle: string;
}

export function EditableTitle({ conversationId, initialTitle }: EditableTitleProps) {
  const labels = useLabels();
  const [title, setTitle] = useState(initialTitle);
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  async function saveTitle(newTitle: string) {
    const trimmed = newTitle.trim();
    if (!trimmed || trimmed === title) {
      setEditing(false);
      return;
    }

    try {
      const res = await fetch(`/api/conversations/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });

      if (res.ok) {
        setTitle(trimmed);
      }
    } catch {
      // Silently fail
    }
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        defaultValue={title}
        maxLength={200}
        dir="auto"
        onBlur={(e) => saveTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") { setEditing(false); }
        }}
        className="text-2xl font-bold bg-transparent border-b border-primary/50 outline-none w-full py-0.5"
      />
    );
  }

  return (
    <h1
      className="text-2xl font-bold cursor-pointer hover:text-primary/80 transition group"
      onClick={() => setEditing(true)}
      title={labels.clickToEditTitle}
    >
      {title}
      <svg className="w-4 h-4 inline-block ms-2 opacity-0 group-hover:opacity-50 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" />
      </svg>
    </h1>
  );
}
