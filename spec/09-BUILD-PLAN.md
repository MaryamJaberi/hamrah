# 09 — Build Plan (milestones)

Work strictly in order. One milestone = one branch `m{n}-{slug}` = one PR. A milestone is done only when every AC of its stories in `07-USER-STORIES.md` has a passing test and `npm run typecheck && npm run build && npm run e2e` are green.

| # | Milestone | Main deliverables | Migration | Size |
|---|---|---|---|---|
| M0 | Baseline | run locally, CI green, friendly errors, test Supabase project, `supabase/tests/` runner | — | S |
| M1 | Scheduling | propose/respond/cancel RPCs, schedule form, chat session cards, upcoming list, series, reminders cron, `.ics`, end connection | 004 | L |
| M2 | Shared room & progress | `session_participants`, realtime room (presence/broadcast/live_state), per-user wrap-up, goal auto-progress, streak, exchange halves, instant session | 005 | L |
| M3 | Exchange & matching v2 | skills, availability, time zone, request/connection kind `exchange`, `suggest_people` SQL, reason chips, search filters | 006 | M |
| M4 | Together | groups (rooms/events), members, group chat, group sessions & reviews, `/together` hub, admin moderation, nav change | 007 | L |
| M5 | Safety & i18n | safety card, phone requirement, safety check-ins, trusted contacts, rules acceptance, KYC image retention, `next-intl` fa/en/nl, Jalali/Gregorian | 008 | L |
| M6 | Money & launch | mentor slots & booking, Stripe Connect payouts, refunds, rate limiting, Sentry, PostHog, prod deploy, Capacitor Android release | 009 | L |

## Per-milestone checklist (agent must report each item)
1. Migration file added, runs on a DB with v1 seed data, RLS enabled, policies + grants present.
2. Types in `lib/types.ts` updated.
3. UI per `06-SCREENS-UX.md` (RTL checked at 375 px and 1280 px).
4. Tests for every AC; SQL tests for every new RPC/policy (positive **and** negative: another user must be denied).
5. Seed script extended so the feature is demoable (`npm run seed`).
6. `README.md` "what's inside" table + env vars updated; `.env.local.example` updated.
7. `02-CURRENT-STATE.md` gap rows marked done; new gaps appended.
8. Short demo script (5 steps) in the PR description.

## Dependencies
M2 depends on M1 (sessions statuses). M4 reuses M2 room. M5 safety check-ins need M1 scheduling. M6 slots need M1. M3 is independent after M0 and can be swapped with M2 if the owner wants matching first.

## Definition of done (product)
- A new user can: sign up → onboard → find a companion → schedule weekly sessions → meet in a shared room → see goal progress and streak → review — in fa, en and nl.
- No RLS gap: a script tries every table/RPC as a random authenticated user and as anon and must be denied for others' data.
- Lighthouse mobile: Performance ≥ 80, Accessibility ≥ 95 on `/login`, `/discover`, `/room/*`.
