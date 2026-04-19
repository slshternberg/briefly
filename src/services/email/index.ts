import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailParams): Promise<void> {
  if (process.env.NODE_ENV === "development" && !process.env.SMTP_USER) {
    console.log(`[Email DEV] To: ${to}\nSubject: ${subject}\n${html}`);
    return;
  }
  await transporter.sendMail({
    from: `"Briefly" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
  });
}

// ── Templates ────────────────────────────────────────────────────────────────

export function buildVerificationEmail(link: string): string {
  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<body style="font-family:Arial,sans-serif;font-size:14px;line-height:1.8;color:#222;max-width:600px;margin:0 auto;padding:24px;direction:rtl;text-align:right;">
  <h2 style="margin-top:0;color:#111;">אמתי את כתובת המייל שלך</h2>
  <p>תודה שנרשמת ל-Briefly. לחצי על הכפתור לאישור כתובת המייל:</p>
  <p>
    <a href="${link}" style="display:inline-block;background:#f97316;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">
      אמת מייל
    </a>
  </p>
  <p style="color:#888;font-size:12px;">הקישור תקף ל-24 שעות. אם לא נרשמת, התעלמי מהודעה זו.</p>
</body>
</html>`;
}

export function buildPasswordResetEmail(link: string): string {
  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<body style="font-family:Arial,sans-serif;font-size:14px;line-height:1.8;color:#222;max-width:600px;margin:0 auto;padding:24px;direction:rtl;text-align:right;">
  <h2 style="margin-top:0;color:#111;">איפוס סיסמה</h2>
  <p>קיבלנו בקשה לאיפוס הסיסמה שלך. לחצי על הכפתור להמשך:</p>
  <p>
    <a href="${link}" style="display:inline-block;background:#f97316;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">
      אפס סיסמה
    </a>
  </p>
  <p style="color:#888;font-size:12px;">הקישור תקף לשעה אחת. אם לא ביקשת איפוס, התעלמי מהודעה זו.</p>
</body>
</html>`;
}
