# ARSHNAZ — ارشناز

اپلیکیشن مدیریت تسک، نوت، عادت و سلامت روان.

## شروع سریع

```bash
npm install --legacy-peer-deps
npm run dev      # http://localhost:8080
npm run build    # dist/
npm run preview  # پیش‌نمایش محصول
```

## متغیرهای محیطی

فایل `.env.example` را کپی کرده و نامش را به `.env` بگذار. مقادیر واقعی را از داشبورد Supabase یا پروژه Lovable بگیر:

```bash
VITE_SUPABASE_PROJECT_ID=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_URL=
```

> این مقادیر publishable/anon هستند و در bundle فرانت‌اند قرار می‌گیرند. RLS سیاست‌های Supabase از داده‌ها محافظت می‌کند. هرگز service role key را در کلاینت قرار نده.

## انتشار روی arshnaz.life (از طریق Lovable)

دامنه `arshnaz.life` از قبل به پروژه Lovable متصل است و Lovable به‌صورت native هاست، SSL و SPA routing را مدیریت می‌کند. نیازی به Vercel/Netlify نیست.

### ۱) اتصال پروژه Lovable به GitHub

1. در ادیتور Lovable: منوی **Plus (+)** پایین چپ → **GitHub** → **Connect project**.
2. Lovable GitHub App را authorize کن.
3. اکانت/سازمان و نام ریپوی `arshnaz` را انتخاب کن و **Create Repository** را بزن.
4. بعد از این، sync دوطرفه است: هر تغییر در Lovable به GitHub push می‌شود و هر push به GitHub در Lovable نمایش داده می‌شود.

> این مخزن (`smart-task-notes-bcbdf89d`) در حال حاضر به Lovable متصل است و sync دوطرفه فعال است. جزئیات بیشتر و عیب‌یابی در [SYNC.md](./SYNC.md).

### ۲) push کردن کد محلی به GitHub

بعد از اینکه Lovable ریپو را ساخت، این دستورات را در ترمینال اجرا کن:

```bash
cd C:\Users\hamed\arshnaz
git remote add origin https://github.com/YOUR_USERNAME/arshnaz.git
git branch -M main
git push -u origin main
```

> اگر Git در PATH نبود، از `Git Bash` یا PowerShell با مسیر کامل استفاده کن:
> `& 'C:\Program Files\Git\cmd\git.exe' push -u origin main`

### ۳) DNS (اگر هنوز ست نشده)

در پنل ثبت‌کننده دامنه `arshnaz.life` این رکوردها را بگذار:

- **A record** `@` → `185.158.133.1`
- **A record** `www` → `185.158.133.1`
- **TXT record** `_lovable` → مقدار نمایش‌داده‌شده در Lovable Domains UI

### ۴) همگام‌سازی کد (Lovable ↔ Local/Devin)

وقتی GitHub وصل شد، workflow استاندارد Git است:

1. قبل از کار محلی: `git pull origin main`
2. تغییرات را در Devin یا local انجام بده و `commit` + `push` کن.
3. Lovable در عرض چند ثانیه تغییرات را می‌گیرد و روی `arshnaz.life` deploy می‌کند.
4. تغییرات در Lovable هم خودکار به GitHub push می‌شوند.

> از force-push یا rewrite history پرهیز کن چون باعث desync شدن Lovable می‌شود.

## قابلیت‌های همگام‌سازی (Sync)

- **داده بین دستگاه‌ها**: برنامه از Supabase Realtime استفاده می‌کند. migration مربوطه در `supabase/migrations/20260707140000_enable_realtime_sync.sql` اضافه شده است. این migration باید در داشبورد Supabase یا از طریق Lovable CLI اعمال شود.
- **PWA auto-update**: در `vite.config.ts` با `registerType: "autoUpdate"`، `clientsClaim: true` و `skipWaiting: true` فعال است و روی هر هاستی (از جمله Lovable) کار می‌کند.
- **کد**: از طریق GitHub + Lovable Integration دوطرفه همگام می‌شود.

## فایل‌های پیکربندی انتشار

- `vercel.json` — تنظیمات Vercel (اختیاری، اگر خواستی بعداً به Vercel منتقل کنی).
- `netlify.toml` — تنظیمات Netlify (اختیاری).
- `supabase/migrations/20260707140000_enable_realtime_sync.sql` — فعال‌سازی Realtime.

