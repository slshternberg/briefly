import { cookies, headers } from "next/headers";

const LANG_COOKIE = "briefly_lang";
const SUPPORTED_LANGUAGES = ["Hebrew", "English", "Yiddish"];
const DEFAULT_LANGUAGE = "English";

/**
 * Detect language from browser Accept-Language header.
 * Maps browser locale codes to our language names.
 */
function detectBrowserLanguage(acceptLanguage: string): string {
  const map: Record<string, string> = {
    he: "Hebrew",
    en: "English",
    yi: "Yiddish",
  };

  // Parse Accept-Language: "he,en-US;q=0.9,en;q=0.8"
  const parts = acceptLanguage.split(",");
  for (const part of parts) {
    const lang = part.trim().split(";")[0].split("-")[0].toLowerCase();
    if (map[lang]) return map[lang];
  }

  return DEFAULT_LANGUAGE;
}

/**
 * Get the current language for server-side rendering.
 * Priority: cookie > browser Accept-Language > default
 */
export async function getServerLanguage(): Promise<string> {
  // 1. Check cookie
  const cookieStore = await cookies();
  const cookieLang = cookieStore.get(LANG_COOKIE)?.value;
  if (cookieLang && SUPPORTED_LANGUAGES.includes(cookieLang)) {
    return cookieLang;
  }

  // 2. Check browser language
  const headerStore = await headers();
  const acceptLanguage = headerStore.get("accept-language");
  if (acceptLanguage) {
    return detectBrowserLanguage(acceptLanguage);
  }

  // 3. Default
  return DEFAULT_LANGUAGE;
}

/**
 * Set language cookie value (for use in API routes).
 * Max-age: 1 year.
 */
export function buildLanguageCookieHeader(language: string): string {
  return `${LANG_COOKIE}=${language}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

export { LANG_COOKIE, SUPPORTED_LANGUAGES };
