"use client";

import { useEffect } from "react";

/**
 * Syncs the server-detected language to a client cookie so that
 * client components using useLabels() always match the server language.
 * Only sets the cookie if it doesn't already exist.
 */
export function LanguageSync({ lang }: { lang: string }) {
  useEffect(() => {
    const match = document.cookie.match(/briefly_lang=(\w+)/);
    if (!match) {
      document.cookie = `briefly_lang=${lang}; path=/; max-age=31536000; samesite=lax`;
    }
  }, [lang]);

  return null;
}
