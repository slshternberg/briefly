export const metadata = {
  title: "עזרה ו-FAQ | Briefly",
};

const FAQ = [
  {
    category: "העלאה ועיבוד",
    items: [
      {
        q: "אילו פורמטים נתמכים?",
        a: "MP3, WAV, M4A, WebM, OGG ו-MP4 (וידאו). גודל מקסימלי: 500MB לקובץ.",
      },
      {
        q: "כמה זמן לוקח העיבוד?",
        a: "בדרך כלל 1-5 דקות, תלוי באורך ההקלטה. שיחות ארוכות (מעל שעה) עשויות לקחת עד 10 דקות. תוכל לסגור את הדפדפן — העיבוד ממשיך ברקע.",
      },
      {
        q: "מה קורה אם העיבוד נכשל?",
        a: "לחץ על 'נסה שנית' בדף השיחה. אם הבעיה חוזרת, בדוק שהקובץ אינו פגום ושיש בו אודיו ברור.",
      },
      {
        q: "האם אפשר לנתח שיחה מחדש?",
        a: "כן. לחץ על 'נתח מחדש' בדף השיחה. ניתוח חוזר צורך שאילתת AI נוספת מהמכסה החודשית.",
      },
    ],
  },
  {
    category: "הגדרות ושפה",
    items: [
      {
        q: "כיצד משנים את שפת הניתוח?",
        a: "בהגדרות → שפת ניתוח ברירת מחדל. ניתן גם לשנות לכל שיחה בנפרד בזמן הניתוח.",
      },
      {
        q: "מה זה 'הוראות מותאמות אישית'?",
        a: "הוראות שמועברות ל-AI לפני כל ניתוח — למשל: 'התמקד בהתנגדויות לקוח' או 'הוסף פריטי פעולה עם תאריך יעד'. מוגדר ברמת סביבת העבודה.",
      },
      {
        q: "מה זה 'דוגמאות סגנון'?",
        a: "מיילים שכתבת בעבר שמאפשרים ל-AI ללמוד את סגנון הכתיבה שלך וליצור מיילים דומים.",
      },
    ],
  },
  {
    category: "AI Chat",
    items: [
      {
        q: "כיצד פועל ה-AI Chat?",
        a: "לאחר ניתוח שיחה, תוכל לשאול שאלות ספציפיות על תוכנה — למשל: 'מה הסיכום של ההתנגדויות?' או 'מי לקח על עצמו אחריות על המשימה X?'",
      },
      {
        q: "האם ה-AI זוכר שיחות קודמות?",
        a: "ה-AI זוכר את ה-thread הנוכחי (עד 20 הודעות אחורה). כל thread הוא עצמאי.",
      },
      {
        q: "מדוע ה-AI לא יודע פרטים מחוץ לשיחה?",
        a: "ה-AI מוגבל לתוכן השיחה שנותחה בלבד. הוא לא ניגש למידע חיצוני.",
      },
    ],
  },
  {
    category: "ניהול צוות וסביבת עבודה",
    items: [
      {
        q: "כיצד מזמינים חבר צוות?",
        a: "הגדרות → חברי הצוות → הזן אימייל ולחץ 'הזמנה'. החבר יקבל מייל עם קישור תקף ל-48 שעות.",
      },
      {
        q: "מה ההבדל בין OWNER, ADMIN ו-MEMBER?",
        a: "OWNER: גישה מלאה + בעלות על החיוב. ADMIN: יכול להזמין/להסיר חברים, לשנות הגדרות. MEMBER: יכול לצפות וליצור שיחות.",
      },
      {
        q: "כיצד מחליפים בין סביבות עבודה?",
        a: "לחץ על שם סביבת העבודה בניווט העליון ובחר מהרשימה.",
      },
    ],
  },
  {
    category: "חיוב ותוכניות",
    items: [
      {
        q: "מה קורה כשמגיעים למגבלה?",
        a: "הפעולה החרגת המגבלה נחסמת עד לתחילת החודש הבא (1 לחודש) או עד שדרוג התוכנית.",
      },
      {
        q: "כיצד משדרגים תוכנית?",
        a: "הגדרות → תוכנית וחיוב → בחר תוכנית ולחץ 'שדרג'. התשלום מבוצע דרך Stripe.",
      },
      {
        q: "כיצד מבטלים מנוי?",
        a: "הגדרות → תוכנית וחיוב → 'נהל חיוב'. הביטול ייכנס לתוקף בסוף תקופת החיוב.",
      },
      {
        q: "האם יש החזר כספי?",
        a: "לא מציעים החזרים על תקופות חלקיות. במקרים חריגים, פנה לתמיכה.",
      },
    ],
  },
];

export default function HelpPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">עזרה ו-FAQ</h1>
      <p className="text-muted-foreground mb-10">תשובות לשאלות הנפוצות ביותר.</p>

      <div className="space-y-10">
        {FAQ.map((cat) => (
          <section key={cat.category}>
            <h2 className="text-lg font-semibold mb-4 text-primary">{cat.category}</h2>
            <div className="space-y-4">
              {cat.items.map((item) => (
                <div key={item.q} className="rounded-xl border border-border bg-card/60 p-5">
                  <h3 className="font-medium mb-2">{item.q}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.a}</p>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-12 rounded-xl border border-primary/20 bg-primary/5 p-6 text-center">
        <h2 className="font-semibold mb-2">לא מצאת תשובה?</h2>
        <p className="text-sm text-muted-foreground mb-3">צור קשר ונחזור אליך בהקדם.</p>
        <a
          href="mailto:support@briefly.co.il"
          className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold brand-gradient text-white glow-orange transition-all hover:scale-[1.02]"
        >
          support@briefly.co.il
        </a>
      </div>
    </div>
  );
}
