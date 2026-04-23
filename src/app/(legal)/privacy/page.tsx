export const metadata = {
  title: "מדיניות פרטיות | Briefly",
};

export default function PrivacyPage() {
  return (
    <article className="prose prose-invert max-w-none">
      <h1 className="text-3xl font-bold mb-2">מדיניות פרטיות</h1>
      <p className="text-muted-foreground text-sm mb-10">עודכן לאחרונה: אפריל 2026</p>

      <Section title="1. מבוא">
        <p>
          Briefly (&quot;השירות&quot;, &quot;אנחנו&quot;) מפעיל פלטפורמה לתמלול וניתוח שיחות עסקיות.
          מדיניות פרטיות זו מסבירה כיצד אנו אוספים, משתמשים ומגנים על המידע שלך.
          השימוש בשירות מהווה הסכמה למדיניות זו.
        </p>
      </Section>

      <Section title="2. מידע שאנו אוספים">
        <ul>
          <li><strong>פרטי חשבון:</strong> שם, כתובת אימייל, סיסמה מוצפנת.</li>
          <li><strong>קבצי אודיו/וידאו:</strong> הקלטות שיחות שאתה מעלה לצורך ניתוח.</li>
          <li><strong>תוכן מעובד:</strong> תמלולים, סיכומים, ופריטי פעולה שנוצרו על ידי AI.</li>
          <li><strong>נתוני שימוש:</strong> מספר שיחות, דקות אודיו, שאילתות AI — לצורך אכיפת מכסות תוכנית.</li>
          <li><strong>נתוני חיוב:</strong> מידע תשלום מעובד על ידי Stripe. אנו לא שומרים פרטי כרטיס אשראי.</li>
        </ul>
      </Section>

      <Section title="3. שימוש במידע">
        <p>אנו משתמשים במידע שלך אך ורק לצורך:</p>
        <ul>
          <li>אספקת השירות — ניתוח שיחות, יצירת סיכומים, שליחת מיילים.</li>
          <li>ניהול חשבונך וסביבת העבודה שלך.</li>
          <li>עיבוד תשלומים וניהול מנויים.</li>
          <li>שיפור השירות על בסיס נתונים אנונימיים.</li>
        </ul>
        <p>אנו <strong>לא</strong> מוכרים את המידע שלך לצדדים שלישיים.</p>
      </Section>

      <Section title="4. שמירת מידע ועיבוד AI">
        <p>
          קבצי האודיו שלך מועברים לשירות Gemini של Google לצורך ניתוח.
          הקבצים אינם נשמרים על ידי Google לאחר העיבוד, בהתאם למדיניות השימוש של Google AI.
          הקבצים שלך מאוחסנים בשרת המאובטח שלנו או ב-AWS S3 (בהתאם להגדרות) עד למחיקתם על ידך.
        </p>
      </Section>

      <Section title="5. אבטחת מידע">
        <ul>
          <li>כל הסיסמאות מוצפנות באמצעות bcrypt.</li>
          <li>תקשורת מוצפנת ב-HTTPS/TLS.</li>
          <li>גישה לנתונים מוגבלת לחברי סביבת העבודה בלבד.</li>
          <li>מפתחות הצפנה מאובטחים בצד השרת.</li>
        </ul>
      </Section>

      <Section title="6. זכויותיך (GDPR ודיני ישראל)">
        <p>בהתאם לחוק הגנת הפרטיות הישראלי ולתקנות GDPR, יש לך זכות:</p>
        <ul>
          <li>לקבל עותק של המידע שנשמר אודותיך.</li>
          <li>לתקן מידע שגוי.</li>
          <li>למחוק את חשבונך וכל הנתונים הקשורים (דרך הגדרות → מחיקת חשבון).</li>
          <li>להגביל או להתנגד לעיבוד מידע.</li>
        </ul>
        <p>לכל פנייה: <strong>privacy@briefly.co.il</strong></p>
      </Section>

      <Section title="7. Cookies">
        <p>
          אנו משתמשים ב-cookie אחד בלבד לצורך שמירת העדפת השפה שלך (<code>briefly_lang</code>).
          אנו לא משתמשים ב-cookies לצורכי פרסום או מעקב.
          ה-session נשמר ב-JWT מאובטח ב-HTTP-only cookie.
        </p>
      </Section>

      <Section title="8. שינויים במדיניות">
        <p>
          אנו עשויים לעדכן מדיניות זו מעת לעת. שינויים מהותיים יודעו בדוא&quot;ל.
          המשך שימוש בשירות לאחר הודעה על שינוי מהווה הסכמה למדיניות המעודכנת.
        </p>
      </Section>

      <Section title="9. יצירת קשר">
        <p>לשאלות בנוגע למדיניות הפרטיות: <strong>privacy@briefly.co.il</strong></p>
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-xl font-semibold mb-3 text-foreground">{title}</h2>
      <div className="text-muted-foreground leading-relaxed space-y-2">{children}</div>
    </section>
  );
}
