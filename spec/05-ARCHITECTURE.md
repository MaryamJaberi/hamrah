# 05 — Architecture & Technical Rules

## Stack (keep)
Next.js 14 App Router · React 18 · TypeScript strict · Supabase (Postgres, Auth, Realtime, Storage) via `@supabase/ssr` · Tailwind 3 · Capacitor 6 · Playwright. Do **not** upgrade Next/React major versions or switch to another backend unless `OPEN-QUESTIONS.md` records a decision to do so.

New dependencies allowed (add only when the milestone needs them):
| Need | Package | Milestone |
|---|---|---|
| Date/time zones | `date-fns` + `date-fns-tz` | M1 |
| Jalali display | `Intl.DateTimeFormat('fa-IR-u-ca-persian')` — no library | M1 |
| `.ics` export | hand-written (RFC 5545, ~30 lines) | M1 |
| i18n | `next-intl` | M5 |
| Rate limiting | `@upstash/ratelimit` + `@upstash/redis` | M6 |
| Errors | `@sentry/nextjs` | M6 |
| Product analytics | `posthog-js` (EU host, opt-in banner) | M6 |

## Layers
```
Browser / Capacitor shell
  ├─ Server Components: read with RLS (lib/supabase/server.ts → getSession())
  ├─ Client Components: writes with RLS or RPC (lib/supabase/client.ts)
  ├─ Realtime: messages, requests, room channels (presence + broadcast)
  └─ Route handlers /api/*: anything needing secrets or the service role (lib/supabase/admin.ts, 'server-only')
Postgres: RLS on every table · security-definer RPCs for multi-row/atomic actions · triggers for derived fields
Cron: /api/cron/* with CRON_SECRET header (Vercel Cron), every 5 min
```

## Rules
1. **RLS first.** Every new table: `enable row level security` + explicit policies in the same migration. Prefer RPCs (`security definer`, `set search_path = public`, `revoke … from public, anon`, `grant execute … to authenticated`) for anything that touches more than one row or another user's data.
2. **Service role only in `/api` and `lib/*` files that import `'server-only'`.**
3. **Never trust the client** for: prices, participant lists, session status transitions, trust columns, timestamps of timer actions (use `now()` in SQL).
4. **Migrations append-only**: `supabase/migrations/00N_name.sql`. Each must run on top of a database that already has v1 data (use `add column if not exists`, backfills).
5. **Types**: extend `lib/types.ts`; keep DB enums and TS unions identical. Optionally generate `supabase gen types typescript` into `lib/database.types.ts`.
6. **Strings**: until M5, Persian strings may stay inline. From M5, all UI strings go through `next-intl` messages (`messages/fa.json`, `en.json`, `nl.json`); keys in English dot-notation (`room.timer.start`).
7. **Dates**: store UTC. Render with the viewer's time zone (`profiles.timezone`). For `fa` locale render Jalali calendar dates and Persian digits; for `en`/`nl` Gregorian.
8. **Accessibility**: every control has a label; `role`/`aria-*` as in v1; E2E runs axe on each new page.
9. **Mobile**: 480 px column (`app/(app)/layout.tsx`), safe-area padding, tap targets ≥ 44 px.
10. **No secrets in the client bundle** — only `NEXT_PUBLIC_*` vars may be read in client components.

## Realtime room design (M2)
- Channel `room:{sessionId}` (Supabase Realtime, private channel with RLS-authorised `realtime.messages` policy: participant only).
- **Presence** payload: `{ userId, name, avatar, status: 'here' | 'away' }` (`away` when `document.visibilityState === 'hidden'`).
- **Broadcast** events: `timer` (state object), `checkin` (userId), `wrapup` (userId), `switch_half`.
- **Source of truth**: `sessions.live_state` written by `room_timer` RPC with `now()`. Each client computes `remaining = planned*60 − (paused_elapsed_s + (running ? now_server − started_at : 0))`. Client estimates server offset from the RPC response's server timestamp.
- Reconnect: on join, fetch `live_state` then subscribe.

## Matching v2 (M3)
Score 0–99, computed in SQL (`suggest_people`) and mirrored in `lib/matching.ts` for tests.
| Signal | Points |
|---|---|
| Each shared interest | +12 (max 36) |
| They teach a language/skill I learn | +25 |
| I teach a language/skill they learn (both ⇒ exchange pair) | +25 |
| Availability overlap (≥1 shared slot after TZ conversion) | +10, ≥3 slots +15 |
| Same city and either side in-person/both | +10 |
| Both online-capable | +5 |
| Verified ID | +6 |
| Rating: `(avg − 3.5) × 4` if `count ≥ 3` | −10…+6 |
| Responsiveness: accepted/declined requests within 48 h ratio ≥ 0.7 | +4 |
| Active in last 14 days | +5; inactive > 60 days: −15 |
Filter by `p_kind`: `exchange` requires both teach/learn directions; `buddy` ignores language terms.

## Notifications
`lib/push.ts` `sendToUser(userId, {title, body, url})` (web push + FCM). New triggers:
| Event | Recipient | Milestone |
|---|---|---|
| Session proposed / accepted / declined / cancelled | other participant | M1 |
| Reminder 24 h / 15 min | all participants | M1 |
| Partner joined the room | other participant(s) | M2 |
| Group join request / approved | host / member | M4 |
| Safety check-in | in-person participants | M5 |
All notification sends happen server-side; client may only *request* a notification for an object it created (existing `/api/notify` pattern).

## Cron jobs (route handlers, `Authorization: Bearer ${CRON_SECRET}`)
| Route | Every | Does |
|---|---|---|
| `/api/cron/reminders` | 5 min | 24 h and 15 min reminders (idempotent via `reminded_*_at`) |
| `/api/cron/finalize` | 15 min | `finalize_sessions()`; expire unpaid slot holds |
| `/api/cron/series` | daily | top up recurring series to 12 upcoming occurrences; recurring group rooms |
| `/api/cron/safety` | 5 min | send safety check-ins; mark `no_answer` after 2 h and alert admin |

## Environment variables (add to `.env.local.example` when introduced)
Existing: see `.env.local.example`. New:
```
CRON_SECRET=                # M1
UPSTASH_REDIS_REST_URL=     # M6
UPSTASH_REDIS_REST_TOKEN=   # M6
SENTRY_DSN=                 # M6
NEXT_PUBLIC_POSTHOG_KEY=    # M6
NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
STRIPE_CONNECT_CLIENT_ID=   # M6
```

## Deployment
- Web: Vercel (Next.js), EU region (`fra1`). Crons in `vercel.json`. Whether Vercel, Supabase and Jitsi are reachable from Iran without a VPN must be tested before launch (see OPEN-QUESTIONS Q7).
- DB: Supabase project in EU (Frankfurt). Separate project for E2E.
- Mobile: Capacitor shell pointing to the production URL (`CAP_SERVER_URL`); Android first (Iranian users mostly Android; Google Play may be unavailable in Iran — provide a direct APK download page as well, see OPEN-QUESTIONS).
- Video: self-hosted Jitsi or JaaS (`NEXT_PUBLIC_JITSI_DOMAIN`) before launch — `meet.jit.si` caps embeds at 5 min.
