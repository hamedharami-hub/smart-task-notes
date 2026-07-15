# راهنمای همگام‌سازی Lovable و GitHub

## وضعیت فعلی

همگام‌سازی دوطرفه بین Lovable و این مخزن GitHub **فعال است**.

- **نام ریپوی متصل:** `haramipours-glitch/smart-task-notes-bcbdf89d`
- **دامنه Lovable:** `arshnaz.life`
- **آخرین تغییرات Lovable:** commits با نویسنده `gpt-engineer-app[bot]` در `main`
- **آخرین تغییرات GitHub:** PRهای ادغام‌شده توسط `haramipours-glitch`

## نحوه کار همگام‌سازی

1. **Lovable → GitHub:** هر تغییری که در ویرایشگر Lovable ایجاد شود، به‌صورت خودکار به شاخه `main` این مخزن push می‌شود.
2. **GitHub → Lovable:** هر commit که به `main` push شود (از طریق PR یا push مستقیم)، پس از چند ثانیه در Lovable نمایش داده می‌شود و روی `arshnaz.life` deploy می‌شود.
3. **Local/Devin → GitHub → Lovable:** تغییرات محلی یا Devin پس از `commit` و `push` روی `main`، از طریق GitHub وارد Lovable می‌شوند.

## بهترین شیوه‌ها

- فقط روی شاخه `main` کار کنید؛ Lovable فقط یک شاخه را همگام نگه می‌دارد.
- هرگز force-push ندهید و history را rewrite نکنید؛ باعث desync Lovable می‌شود.
- از تغییر هم‌زمان یک فایل در Lovable و GitHub خودداری کنید؛ در صورت conflict، نسخه‌ای که آخرین push را دارد باقی می‌ماند.
- برای تست‌های آزمایشی از branchهای جداگانه استفاده کنید و بعد merge کنید.
- قبل از کار محلی همیشه `git pull origin main` بزنید.

## بررسی سلامت sync

برای اطمینان از کارکرد sync:

```bash
git log --oneline -10
```

باید commits از `gpt-engineer-app[bot]` (Lovable) و commits از `hamed haramipoor` / `haramipours-glitch` (Devin/GitHub) را ببینید.

اگر فقط commits یک طرف را دیدید، sync احتمالاً قطع شده و باید Lovable را از Settings → Git → GitHub مجدداً connect کنید.

## عیب‌یابی

| مشکل | راه‌حل |
|------|--------|
| تغییر Lovable در GitHub نیست | چند ثانیه صبر کنید؛ در Settings → Git Lovable وضعیت Connected را بررسی کنید. |
| تغییر GitHub در Lovable نیست | مطمئن شوید push روی `main` انجام شده و force-push نبوده. |
| conflict هنگام sync | نسخه مورد نظر را دستی merge کنید و دوباره push کنید. |
| ریپو rename شد | sync قطع می‌شود؛ باید در Lovable disconnect و reconnect کنید. |

## لینک‌ها

- [مخزن GitHub](https://github.com/haramipours-glitch/smart-task-notes-bcbdf89d)
- [راهنمای Lovable Git sync](https://docs.lovable.dev/integrations/github)
