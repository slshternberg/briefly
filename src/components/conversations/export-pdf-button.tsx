"use client";

import { useState } from "react";

interface ExportPdfButtonProps {
  title: string;
  sections: { heading: string; content: string }[];
  rtl?: boolean;
}

export function ExportPdfButton({ title, sections, rtl = false }: ExportPdfButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const html2pdf = (await import("html2pdf.js")).default;

      const dir = rtl ? "rtl" : "ltr";
      const align = rtl ? "right" : "left";

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; direction: ${dir}; text-align: ${align}; padding: 20px; color: #111;">
          <h1 style="font-size: 22px; margin-bottom: 4px;">${escapeHtml(title)}</h1>
          <hr style="margin-bottom: 20px; border: none; border-top: 1px solid #ddd;" />
          ${sections
            .filter((s) => s.content.trim())
            .map(
              (s) => `
            <div style="margin-bottom: 20px;">
              <h2 style="font-size: 14px; font-weight: bold; color: #444; margin-bottom: 6px;">${escapeHtml(s.heading)}</h2>
              <p style="font-size: 13px; line-height: 1.7; white-space: pre-wrap; color: #222;">${escapeHtml(s.content)}</p>
            </div>`
            )
            .join("")}
        </div>
      `;

      const element = document.createElement("div");
      element.innerHTML = htmlContent;
      document.body.appendChild(element);

      await html2pdf()
        .set({
          margin: [15, 15, 15, 15],
          filename: `${title.slice(0, 60)}.pdf`,
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        })
        .from(element)
        .save();

      document.body.removeChild(element);
    } catch (err) {
      console.error("PDF export failed:", err);
    } finally {
      setLoading(false);
    }
  }

  function escapeHtml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-card/50 transition disabled:opacity-50"
    >
      {loading ? (
        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
      )}
      {loading ? (rtl ? "מייצא..." : "Exporting...") : (rtl ? "ייצא PDF" : "Export PDF")}
    </button>
  );
}
