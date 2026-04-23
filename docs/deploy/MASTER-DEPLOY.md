# Master deploy guide

End-to-end runbook. Read every line before you start any command —
there's a pre-flight section that will save you a lot of pain.

## לפני שאתה מתחיל

- [ ] זמן פנוי רצוף: ~45 דקות (30 דקות מינימום, 60 אם זו הפעם הראשונה).
- [ ] גישת SSH לשרת הפרוד'. ודא שאתה יכול להתחבר *עכשיו*, לא אחרי
      שכבר התחלת.
- [ ] גישת push ל-GitHub (או לריפו שלך).
- [ ] אתה במצב רוח רגוע. אם אתה עייף, לחוץ, או ממהר — דחה למחר.
      Deploy מהיר = bug מהיר.
- [ ] פתוח ליד: `docs/deploy/ENV-VARS-CHECKLIST.md` —
      רשימת env vars.
- [ ] פתוח ליד: `docs/deploy/auth-secret-rotation.md` —
      הוראות ל-AUTH_SECRET אם זו הפעם הראשונה.

---

## שלב 0 — גיבוי DB

**למה:** אם משהו במיגרציה ישבור נתונים, זה הגיבוי היחיד שיחזיר
אותך אחורה. תעשה את זה לפני כל פעולה אחרת.

SSH לשרת, ואז:

```bash
# תחליף את המשתמש/הסיסמה/שם ה-DB בערכים שלך (מ-DATABASE_URL).
pg_dump -U briefly_user -h localhost briefly_db > \
  ~/backups/briefly-$(date +%Y%m%d-%H%M).sql

# ודא שהקובץ נוצר עם גודל סביר (לא 0 בתים):
ls -lh ~/backups/briefly-*.sql | tail -1
```

**מה צפוי:** שורה עם הקובץ החדש וגודל של כמה MB לפחות.

**אם נכשל:** הגיבוי חייב להצליח לפני שממשיכים. בדוק credentials, הרשאות.

---

## שלב 1 — Local: סיבוב AUTH_SECRET (אם עוד לא)

**למה:** בוני commit `af25431` מחייב `AUTH_SECRET` ≥32 תווים. אם
ה-`.env.local` שלך עם secret קצר יותר, `npm run build` ייפול.

צור ערך חדש:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

העתק את הפלט (מחרוזת של 96 תווים hex). פתח את `.env.local`
במחשב המקומי ועדכן:

```
AUTH_SECRET="<הדבק-כאן-את-המחרוזת>"
```

**שמור את הקובץ.**

---

## שלב 2 — Local: וידוא build

```bash
npm run build
```

**מה צפוי:** build מצליח. תראה טבלה של routes ובסוף שורת `Finalizing`.

**אם נכשל עם `AUTH_SECRET must be at least 32 chars`:** שלב 1 לא בוצע או
המחרוזת נכנסה עם תווים מיותרים (רווח, גרש). תקן ונסה שוב.

**אם נכשל עם שגיאה אחרת:** הולך ל-Troubleshooting בסוף המסמך.

---

## שלב 3 — Local: git push

```bash
git status        # צריך להיראות נקי (רק .env.local מחוץ לגיט)
git log --oneline -5     # תראה את ה-commits האחרונים

git push origin master
```

**מה צפוי:** `Writing objects: 100% ... master -> master`.

**אל תעשה `--force`**. לעולם.

---

## שלב 4 — Server: env vars חדשים

SSH לשרת, ואז:

```bash
cd /path/to/briefly     # בהנחה שהריפו שם
nano .env               # או עורך לבחירתך
```

**הוסף (אם חסר) את כל מה שמופיע ב-`docs/deploy/ENV-VARS-CHECKLIST.md`
בעמודת "Required".** ודא במיוחד:

- `AUTH_SECRET` — אותו ערך כמו שיצרת בשלב 1, או צור חדש *על השרת*
  (`openssl rand -base64 32`). הערכים במקומי ובשרת לא חייבים להיות
  זהים — הם שני סשנים שונים.
- `ENCRYPTION_KEY` — אם אתה מגדיר לראשונה:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- `AUTH_URL` — URL מלא של האתר בפרוד (לדוגמה `https://briefly.example.com`).
  בלי trailing slash.
- `GEMINI_API_KEY`, `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` — יעדים אמיתיים.

שמור את הקובץ (`Ctrl+O`, `Enter`, `Ctrl+X` ב-nano).

בדוק:

```bash
npm run check:env
```

**מה צפוי:** יציאה בקוד 0, ללא שום שגיאה. אם יש `Missing/invalid
environment variables` — תקן את הקובץ.

---

## שלב 5 — Server: git pull + npm install

```bash
git pull origin master
```

**מה צפוי:** `Fast-forward` עם רשימת קבצים.

```bash
npm install --legacy-peer-deps
```

**מה צפוי:** `added/updated XX packages` בלי אזהרות אדומות.

**אם נכשל:**
- `peer dep conflicts` → ודא שהרצת עם `--legacy-peer-deps`.
- `permission denied` → השתמש ב-`sudo` או ודא שאתה נכנס עם משתמש שיש
  לו הרשאה.

---

## שלב 6 — Server: Prisma migrations

```bash
npx prisma migrate deploy
```

**מה צפוי:** שורות `Applying migration 20xxxxxx_...` לכל migration חדש,
ובסוף `All migrations have been successfully applied`.

**אם אין migrations חדשים:** `No pending migrations to apply.`.
זה תקין.

**אם נכשל באמצע:**
- שחזר את הגיבוי משלב 0 (ראה Rollback).
- אל תנסה להריץ שוב בלי להבין מה קרה — migrations חלקיים משאירים את
  ה-DB במצב לא עקבי.

---

## שלב 7 — Server: backfills (רק בהפעלה ראשונה של Level 0)

**דלג על השלב הזה אם כבר רצת את ה-Level-0 backfills פעם אחת.**
הם idempotent אבל לא יש סיבה להריץ שוב.

רשימת ה-scripts מ-`docs/deploy/level-0-full-sequence.md`:

```bash
# 2a — Encrypt existing OAuth tokens
DRY_RUN=true npx tsx src/scripts/backfill/encrypt-google-tokens.ts
npx tsx src/scripts/backfill/encrypt-google-tokens.ts

# 2b — Extract audio durations for existing conversations
DRY_RUN=true npx tsx src/scripts/backfill/extract-asset-durations.ts
npx tsx src/scripts/backfill/extract-asset-durations.ts

# 2c — Recount storage usage
DRY_RUN=true npx tsx src/scripts/backfill/recount-storage.ts
npx tsx src/scripts/backfill/recount-storage.ts
```

**מה צפוי:** כל script מדפיס כמה שורות עודכנו. שים לב ל-DRY_RUN קודם —
ודא שהמספרים סבירים לפני שמריץ בלי DRY_RUN.

---

## שלב 8 — Server: pm2 restart

```bash
pm2 restart briefly --update-env
pm2 logs briefly --lines 50
```

**מה צפוי ב-logs:**
- `[startup] Recovered 0 stuck conversation(s) from previous run.` —
  או מספר > 0 אם היו conversations תקועים.
- `[startup] Instrumentation ready (recovery done, cron scheduled).`
- `Ready in XXXms` — אם Next.js עלה בסדר.

**אם אתה רואה `Missing/invalid environment variables`:** השרת בוט את
ה-`.env` שעדכנת בשלב 4. חזור לשלב 4.

לחץ `Ctrl+C` לצאת מ-`pm2 logs`.

---

## שלב 9 — בדיקה שהאתר עולה

מהדפדפן, לא מה-SSH:

- [ ] `https://your-domain.com` — עולה עמוד הבית?
- [ ] `https://your-domain.com/login` — עולה טופס login?
- [ ] Login עם משתמש קיים — מצליח?
- [ ] `/dashboard` מופיע אחרי login?
- [ ] העלאת הקלטה קצרה → ניתוח → תוצאה?
- [ ] (אם Gmail connected) שליחת מייל עובדת?
- [ ] (אם יש חשבון Admin) `/dashboard/settings` מציג billing section?

אם *משהו* לא עובד — אל תשחרר את ה-SSH. לך ל-Troubleshooting.

---

## Troubleshooting

### "Invalid environment variables"
השרת לא רואה את ה-`.env` שעדכנת. ודא:
- נמצא באותה ספרייה שממנה `pm2` קורא (`pm2 describe briefly`).
- `pm2 restart briefly --update-env` (עם `--update-env`!).

### `AUTH_SECRET must be at least 32 chars`
ה-secret קצר מ-32 תווים. העתקה מגורמת דפ לפעמים מחסירה תווים סופיים.
צור חדש ונסה שוב.

### `Failed to collect page data for /api/...`
route נכשל בבנייה. בדוק שכל ה-env vars הנדרשים מופיעים וצורתם תקינה
(`AUTH_URL` עם `https://`, `ENCRYPTION_KEY` עם 64 hex chars).

### `ECONNREFUSED` ב-logs אחרי restart
PostgreSQL לא רץ או לא מקבל חיבורים. `systemctl status postgresql` /
`docker ps | grep postgres`.

### HTTP 500 על /login
בדוק `pm2 logs briefly --err`. הסיבה הנפוצה: `AUTH_URL` לא תואם
ל-URL של הדפדפן (למשל `http` מול `https`, או `www` מול אין `www`).

### HTTP 502 מ-nginx
השרת חי אבל nginx לא מוצא אותו. בדוק שהאפליקציה רצה: `pm2 list` →
`briefly` במצב `online`. אם לא — `pm2 restart briefly` שוב ובדוק
`pm2 logs`.

---

## Rollback

אם אחרי שלב 8 משהו נשבר בצורה שלא מאפשרת למשתמשים להשתמש במערכת:

```bash
# SSH לשרת
cd /path/to/briefly

# מצא את ה-commit הקודם
git log --oneline -10

# חזור אליו
git checkout <previous-commit-hash>
npm install --legacy-peer-deps
npm run build
pm2 restart briefly --update-env
```

**אם גם המיגרציה שברה משהו ב-DB:**

```bash
# שחזר מהגיבוי של שלב 0
psql -U briefly_user -h localhost briefly_db < ~/backups/briefly-XXXXXXXX-XXXX.sql
```

**אחרי שהמערכת חזרה לעבוד:** פתח `BLOCKED.md` או Slack לצוות, תעד מה
נשבר ומה עשה rollback. אל תנסה שוב את אותו deploy בלי להבין למה הוא
נפל.

---

## אחרי deploy מוצלח

- [ ] סגור `pm2 logs` אם עוד פתוח.
- [ ] עדכן סטטוס למי שצריך לדעת (מייל, Slack).
- [ ] ב-24 השעות הקרובות — הצץ מדי פעם ב-`pm2 logs --lines 200` ואת
      המסך של Sentry / מקום שבו אתה צופה בשגיאות.
- [ ] בסוף השבוע: קרא את `TODO-observed.md` ותחליט מה הפריט הבא.
