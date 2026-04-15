import type { Metadata } from "next";
import "./globals.css";
import { getServerLanguage } from "@/lib/language";
import { isRTL, getHtmlLang } from "@/lib/ui-labels";
import { LanguageSync } from "@/components/language-sync";

export const metadata: Metadata = {
  title: "Briefly — AI Meeting Summaries",
  description:
    "Record conversations, get AI-powered summaries, and chat with your meetings.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const lang = await getServerLanguage();
  const rtl = isRTL(lang);
  const htmlLang = getHtmlLang(lang);

  return (
    <html lang={htmlLang} className="dark" dir={rtl ? "rtl" : "ltr"}>
      <body className="antialiased min-h-screen">
        <LanguageSync lang={lang} />
        {children}
      </body>
    </html>
  );
}
