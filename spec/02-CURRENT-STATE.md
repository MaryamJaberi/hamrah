# 02 — Current State of the Codebase (v1, commit `95f6a71`)

This is a **brownfield** project. v1 works. Extend it; do not rewrite it.

## Stack
- Next.js 14.2 (App Router, server components, middleware), React 18, TypeScript
- Supabase (Postgres + Auth + Realtime + Storage), `@supabase/ssr`
- Tailwind 3, Vazirmatn font, RTL
- Capacitor 6 shell (loads the deployed URL; no static export)
- Playwright E2E + axe, GitHub Actions CI
- Integrations (each enabled only when its env key exists): Jitsi, Web Push (VAPID), FCM HTTP v1, Stripe, Zarinpal, Kavenegar, Twilio, Persona

## Folder map
```
app/
  login/            email or SMS OTP login
  auth/confirm/     magic-link token_hash confirm
  onboarding/       3-step profile creation (name/city/avatar → interests → languages/mode)
  banned/
  (app)/            authenticated app shell with bottom Nav
    discover/       ranked suggestions + incoming requests
    search/         advanced search (search_people RPC)
    goals/          CRUD goals, manual ±10% progress
    chat/, chat/[id]  connection list, realtime chat
    room/[id]       focus room: timer, check-in, checklist, prompt cards, Jitsi tab, wrap-up
    sessions/       stats, start session, history, pending reviews
    mentors/        mentor list
    u/[id]          public profile, request, book mentor, reviews, safety menu
    profile/        edit profile, mentor settings, push toggle, export/delete
    verify/         KYC (national ID / passport upload, or Persona)
  admin/            dashboard, kyc, reports, users, payments (desktop width; is_admin guard)
  api/              account, admin/*, auth/otp/*, kyc/persona(+webhook), notify, payments/stripe|zarinpal, push/subscribe, test/login (E2E only)
components/         Nav, RequestForm, ReviewForm, SafetyMenu, StarRating, UserCard, VerifyBadges, PushToggle, NativeInit
lib/                supabase/{client,server,admin}, api-auth (requireUser, requireAdmin), matching, connections, payments, push, sms, otp, notify, format, constants, types
middleware.ts       auth + onboarding + ban redirects
app/layout.tsx, app/page.tsx, app/not-found.tsx, app/globals.css
(client components inside route folders: chat/[id]/ChatRoom.tsx, profile/ProfileForm.tsx, verify/KYCClient.tsx, room/[id]/RoomClient.tsx, discover/DiscoverClient.tsx, goals/GoalsClient.tsx)
supabase/migrations 001_core, 002_trust, 003_otp_search_push_payments
e2e/                public.spec.ts (no backend), app.spec.ts (needs test Supabase)
scripts/seed.mjs    7 sample users incl. 2 mentors; SEED_ADMIN_EMAIL makes an admin
```

## Data model today (summary — full DDL in migrations)
`profiles`, `goals`, `requests`, `connections (kind buddy|mentorship)`, `messages`, `sessions`, `reviews`, `reports`, `blocks`, `kyc_submissions`, `otp_codes`, `push_subs`, `native_push_tokens`, `payments`.
RPCs: `accept_request`, `start_free_mentorship`, `search_people`, helpers `is_admin`, `is_participant`, `is_blocked_between`. Triggers: `refresh_rating`, `sync_kyc_to_profile`, `profile_verification_flags`.

## Security invariants already in place (must stay true)
- Trust/admin columns on `profiles` (`is_admin`, `verified_*`, `rating_*`, `kyc_status`, `is_banned`) are not writable by users (column grants).
- Connections are created only by `accept_request()`, `start_free_mentorship()`, or verified payment (`fulfillPayment`).
- Payment amount is read from DB, never from the client; Zarinpal callback matched to stored authority; fulfilment idempotent.
- Notifications can only be triggered for messages/requests the caller created.
- KYC files in private bucket; admin sees 10-min signed URLs only.
- Stripe/Persona webhooks verify signatures.
- OTP hashed (HMAC), rate-limited, 5 attempts.
- Reviews require a `done` session in that connection.
- Blocked users cannot request or message each other.
- `/api/test/login` is inert unless `E2E_TEST_SECRET` is set; never set it in production.

## Gaps and known limitations (what v2+ must address)
| # | Gap | Where it shows | Milestone |
|---|---|---|---|
| G1 | Sessions only start "now"; no scheduling, recurrence, invites, or reminders | `sessions` has `planned` status but nothing uses it | M1 |
| G2 | Room is not shared: each participant has their own timer/check-in; only the person who presses "finish" stores a session (`host`) | `RoomClient.tsx` | M2 |
| G3 | Goal progress is manual (±10%); sessions are not linked to goals; no streaks | `GoalsClient.tsx` | M2 |
| G4 | Exchange is languages-only (`teach_langs`/`learn_langs`); no general skills; connection kind has no `exchange` | `profiles`, `matching.ts` | M3 |
| G5 | No availability / time zones in matching | `matching.ts` | M3 |
| G6 | No group rooms, events, or "go together" posts | — | M4 |
| G7 | In-person mode has no safety flow (public place, trusted contact, safety check-in) | — | M5 |
| G8 | UI strings hard-coded in Persian; no i18n | everywhere | M5 |
| G9 | No mentor payouts (Stripe Connect), refunds, or mentor time slots | `lib/payments.ts` | M6 |
| G10 | No global rate limiting, error monitoring, or product analytics | — | M6 |
| G11 | `meet.jit.si` limits embedded calls to 5 min | `.env` `NEXT_PUBLIC_JITSI_DOMAIN` | M6 (config) |
| G12 | Connections cannot be ended / archived by users | `connections.status` | M1 |
| G13 | `matchScore` can drop below the floor for low-rated users only via clamp; rating weight is ad hoc | `matching.ts` | M3 |
| G15 | Discover hides only users *I* blocked; if B blocked A, A still sees B (RLS on `blocks` only exposes own rows). `search_people` is correct. Fix with an `is_blocked_between` filter (e.g. small RPC `hidden_user_ids()`) | `discover/page.tsx` | M0 |
| G14 | Discover takes the 100 newest profiles and ranks them in JS — good matches outside those 100 are never shown | `discover/page.tsx` | M3 |
