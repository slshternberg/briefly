"use client";

import { useState, useEffect } from "react";
import { getLabels, type UILabels } from "./ui-labels";

export function getClientLanguage(): string {
  if (typeof document === "undefined") return "English";
  const match = document.cookie.match(/briefly_lang=(\w+)/);
  return match?.[1] || "English";
}

// Starts with "English" to match the SSR render, then updates after mount.
// This prevents the React hydration mismatch (#418) that occurred when the
// cookie contained a non-English language and the SSR/client values differed.
export function useLabels(): UILabels {
  const [labels, setLabels] = useState(() => getLabels("English"));

  useEffect(() => {
    const lang = getClientLanguage();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (lang !== "English") setLabels(getLabels(lang));
  }, []);

  return labels;
}
