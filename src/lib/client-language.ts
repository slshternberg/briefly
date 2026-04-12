"use client";

import { getLabels, type UILabels } from "./ui-labels";

/**
 * Read language from cookie on the client side.
 */
export function getClientLanguage(): string {
  if (typeof document === "undefined") return "English";
  const match = document.cookie.match(/briefly_lang=(\w+)/);
  return match?.[1] || "English";
}

/**
 * Get labels for the current client language.
 */
export function useLabels(): UILabels {
  return getLabels(getClientLanguage());
}
