# همراه — Hamrah

پلتفرم پیدا کردن همراه برای انجام کارها (بادی‌دابلینگ)، تبادل زبان و منتورشیپ.
Next.js 14 (App Router) + Supabase + Tailwind، راست‌به‌چپ و موبایل‌محور.

## چه چیزی داخلش هست

| بخش | مسیر |
|---|---|
| ورود با کد ایمیل یا پیامک (کاوه‌نگار برای ‎+98، Twilio برای بقیه) | `app/login`, `app/api/auth/otp/*` |
| آنبوردینگ ۳ مرحله‌ای، پروفایل، هدف‌ها | `app/onboarding`, `app/(app)/profile`, `app/(app)/goals` |
| کشف با امتیاز تطابق، درخواست اتصال، جستجوی پیشرفته | `app/(app)/discover`, `app/(app)/search`, `lib/matching.ts` |
| چت real-time | `app/(app)/chat` |
| اتاق جلسه: تایمر، چک‌این، چک‌لیست، کارت‌های گفتگو، تماس Jitsi | `app/(app)/room/[id]` |
| نظر و امتیاز (فقط بعد از یک جلسه واقعی)، گزارش و مسدودسازی | `components/ReviewForm.tsx`, `components/SafetyMenu.tsx` |
| تأیید هویت: کارت ملی/پاسپورت با بررسی ادمین، یا Persona | `app/(app)/verify`, `app/api/kyc/*` |
| منتورشیپ: رایگان، Stripe (USD/EUR)، زرین‌پال (تومان) | `app/(app)/u/[id]`, `app/api/payments/*` |
| اعلان Web Push و Push بومی (FCM HTTP v1) | `lib/push.ts`, `components/PushToggle.tsx` |
| کنسول ادمین: داشبورد، KYC، گزارش‌ها، کاربران، پرداخت‌ها | `app/admin/*` |
| خروجی داده و حذف حساب | `app/api/account` |
| اپ موبایل با Capacitor | `capacitor.config.ts` |
| تست E2E با Playwright + CI | `e2e/`, `.github/workflows/ci.yml` |

## راه‌اندازی

```bash
npm install
cp .env.local.example .env.local   # مقادیر Supabase را پر کن
```

**Supabase**
1. یک پروژه بساز و فایل‌های `supabase/migrations/001…003` را به ترتیب در SQL Editor اجرا کن (یا `supabase db push`).
2. Authentication → Email Templates → **Magic Link**: متن را طوری تغییر بده که کد ۶ رقمی را بفرستد:
   `کد ورود شما: {{ .Token }}` — و اگر لینک هم می‌خواهی:
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}`
3. Authentication → URL Configuration → Site URL را روی آدرس اپ بگذار.

```bash
npm run dev
npm run seed                                   # ۷ کاربر نمونه، شامل دو منتور
SEED_ADMIN_EMAIL=you@example.com npm run seed  # بعد از اولین ورود، خودت را ادمین کن
```

در توسعه، `SMS_DEV_LOG=true` کد پیامک را به‌جای ارسال در لاگ سرور چاپ می‌کند.

**اختیاری‌ها** — هر کدام فقط وقتی کلیدش را بگذاری فعال می‌شود:
- Web Push: `npx web-push generate-vapid-keys`
- Stripe: `stripe listen --forward-to localhost:3000/api/payments/stripe/webhook`
- زرین‌پال: `ZARINPAL_MERCHANT_ID` و `ZARINPAL_SANDBOX=true` برای تست
- Persona: الگو + webhook به `/api/kyc/persona/webhook`
- ویدیو: `meet.jit.si` تماس‌های embed را به ۵ دقیقه محدود می‌کند؛ برای استفاده واقعی `NEXT_PUBLIC_JITSI_DOMAIN` را روی سرور Jitsi خودت یا JaaS بگذار.

## اپ موبایل

اپ از رندر سمت سرور، middleware و API استفاده می‌کند، پس خروجی استاتیک ممکن نیست. پوستهٔ Capacitor نسخهٔ دیپلوی‌شده را باز می‌کند:

```bash
CAP_SERVER_URL=https://your-domain npx cap add android   # یا ios
npm run cap:android
```
برای push بومی: `google-services.json` / APNs را در Firebase تنظیم کن و `FCM_PROJECT_ID` و `FCM_SERVICE_ACCOUNT_JSON` را بگذار.

## تست

```bash
npm run e2e
```
تست‌های عمومی (ورود، محافظت از API، دسترس‌پذیری) بدون بک‌اند اجرا می‌شوند.
برای جریان‌های واردشده (آنبوردینگ، هدف، درخواست ← قبول ← چت real-time، منع ادمین) یک پروژهٔ Supabase مخصوص تست بساز و `E2E_TEST_SECRET` را تنظیم کن. **این متغیر را هرگز در production نگذار.**

## امنیت — نکات مهم طراحی

- ستون‌های حساس پروفایل (`is_admin`, `verified_*`, `rating_*`, `is_banned`) با grant ستونی از دسترس کاربر خارج‌اند؛ فقط سرور و تریگرها آن‌ها را می‌نویسند.
- اتصال فقط از طریق `accept_request()`، منتورشیپ رایگان، یا پرداخت تأییدشده ساخته می‌شود.
- مبلغ پرداخت همیشه از دیتابیس خوانده می‌شود، نه از مرورگر؛ callback زرین‌پال با authority ذخیره‌شده تطبیق داده می‌شود و تحویل idempotent است.
- ارسال اعلان فقط برای پیام/درخواستی ممکن است که خود کاربر ساخته.
- فایل‌های KYC در bucket خصوصی‌اند و ادمین فقط لینک امضاشدهٔ ۱۰ دقیقه‌ای می‌بیند.
- webhookهای Stripe و Persona امضا را بررسی می‌کنند.
- کد OTP هش‌شده ذخیره می‌شود، با محدودیت نرخ و ۵ تلاش.

## نسخهٔ بعد

بستهٔ مشخصات نسخهٔ ۲ برای ساخت با ایجنت کدنویسی (Antigravity) در پوشهٔ [`spec/`](spec/README.md) است: کانسپت، وضعیت فعلی و شکاف‌ها (G1–G15)، مدل داده، داستان‌های کاربری با معیار پذیرش، برنامهٔ ساخت M0 تا M6 و پرامپت‌های آماده در `spec/PROMPTS.md`.

## هنوز ساخته نشده

- زمان‌بندی جلسه در آینده + یادآور (الان جلسه‌ها «همین حالا» شروع می‌شوند)
- ایونت‌ها، گروه‌ها و کامیونیتی (فاز ۴ نقشه راه)
- بازپرداخت و تسویه با منتورها (Stripe Connect)
- محدودیت نرخ عمومی (مثلاً Upstash) و مانیتورینگ (Sentry/PostHog)
