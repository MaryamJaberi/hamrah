# 07 — User Stories & Acceptance Criteria

Format: **ID — As a … I want … so that …** then acceptance criteria (AC). Each AC must be covered by an E2E test (Playwright, `e2e/`) or an SQL test (`supabase/tests/*.sql` using `pgTAP` or plain assertions run by a script) — the test file is named in brackets.

---

## M0 — Baseline (v1 health)
**S0.1 — As the owner, I want the v1 project to run locally and in CI so that new work starts from green.**
- AC1 `npm ci && npm run typecheck && npm run build` pass.
- AC2 `npm run e2e -- --project=mobile` passes the public suite.
- AC3 With a test Supabase project and `E2E_TEST_SECRET`, `e2e/app.spec.ts` passes.
- AC4 Onboarding no longer shows raw DB error text; shows "ذخیره نشد، دوباره امتحان کن".
- AC5 Gap G15 fixed: if B blocked A, B does not appear in A's discover (two-browser E2E test).

## M1 — Scheduling
**S1.1 — As a user, I want to propose a session time to my companion so that we commit to a slot.** [e2e/schedule.spec.ts]
- AC1 Chat header has "📅 برنامه‌ریزی"; form per `06-SCREENS-UX.md`.
- AC2 Partner's local time is displayed when time zones differ.
- AC3 Submitting creates a `proposed` session and a session card in chat for both users in real time.
- AC4 Start time in the past or > 90 days ahead is rejected client- and server-side.

**S1.2 — As the invited partner, I want to accept, decline, or suggest another time.** [schedule.spec.ts]
- AC1 Card shows Accept / Decline / Another time; only the non-proposer sees them.
- AC2 Accept → `planned`, proposer gets push "سارا جلسه رو قبول کرد".
- AC3 Decline asks an optional reason; → `cancelled`.
- AC4 "Another time" opens the form prefilled; old proposal becomes `cancelled`.

**S1.3 — As a user, I want weekly recurring sessions.** [schedule.spec.ts, sql/series.sql]
- AC1 Weekly + weekdays + (until date | count) generates ≤ 12 occurrences in the user's time zone, correct across DST changes (test Europe/Amsterdam and Asia/Tehran).
- AC2 Accepting the first proposal accepts the series.
- AC3 Cancelling one occurrence does not cancel the series; "cancel all future" does.

**S1.4 — As a user, I want reminders.** [sql/reminders.sql, api test]
- AC1 Cron sends a push at T−24 h (only if scheduled > 24 h ahead) and at T−15 min.
- AC2 Re-running the cron does not send duplicates.
- AC3 Without `CRON_SECRET` header the route returns 401.

**S1.5 — As a user, I want to see upcoming sessions and add them to my calendar.** [schedule.spec.ts]
- AC1 `/sessions` shows "Upcoming" sorted by time with Jalali date (fa) or Gregorian (en/nl).
- AC2 "Join" button enabled from T−10 min until planned end.
- AC3 "Add to calendar" downloads a valid `.ics` (one event, or RRULE for series).

**S1.6 — As a user, I want to cancel a session or end a connection.** [schedule.spec.ts]
- AC1 Cancel < 2 h before start sets `late_cancel=true` and tells the user it was a late cancel.
- AC2 End connection hides it from chat list and discover's "connected" filter; future sessions cancelled; history kept.

## M2 — Shared room & progress
**S2.1 — As participants, we want one shared timer.** [e2e/room.spec.ts with two browser contexts]
- AC1 Start in context A shows running timer in B within 2 s; remaining times differ by ≤ 1 s.
- AC2 Pause/reset from B reflects in A.
- AC3 Reloading a page restores the correct remaining time.

**S2.2 — As participants, we want to see who is here and each other's check-in.** [room.spec.ts]
- AC1 Presence shows both avatars; hiding tab marks "away".
- AC2 Check-in submitted by A appears read-only in B.
- AC3 Notes and personal checklist are never sent to B (assert no network payload contains them).

**S2.3 — As a user, I want a session record and goal progress after wrap-up.** [room.spec.ts, sql/room.sql]
- AC1 Each participant submits their own wrap-up; session becomes `done` when all did, or by cron at planned end + 30 min if timer ran ≥ 1 min.
- AC2 New goals get `target_sessions = per_week × 4` (editable). Ticking "moved my goal" increments `completed_sessions`; progress = round(100 × completed / target), capped at 100.
- AC3 Both can review each other once; review insert fails for a non-participant.
- AC4 Instant session from chat (`/room/now/[connId]`) works without scheduling.

**S2.4 — As a user, I want a weekly streak.** [sql/streak.sql, goals.spec.ts]
- AC1 Streak = consecutive ISO weeks (user's TZ) with ≥ 1 done session, ending this week or last week.
- AC2 Shown on `/sessions` and `/goals` with non-judgemental copy when 0.

**S2.5 — As exchange partners, we want the timer split into two halves.** [room.spec.ts]
- AC1 For `exchange` connections, room shows half labels from the two directions of the exchange; at half time both get a "switch" prompt.

## M3 — Exchange & better matching
**S3.1 — As a user, I want to list skills (not only languages) I can teach and want to learn.** [profile.spec.ts]
- AC1 Profile and onboarding have teach/learn skills (suggested list + free text, max 10 each, ≤ 30 chars).
**S3.2 — As a user, I want to give my availability and time zone.** [profile.spec.ts]
- AC1 Time zone auto-detected (`Intl.DateTimeFormat().resolvedOptions().timeZone`) and editable.
- AC2 Six availability chips; at least one required for discover ranking bonus.
**S3.3 — As a user, I want suggestions ranked by the v2 score with reasons.** [sql/suggest.sql, discover.spec.ts]
- AC1 `suggest_people` returns ≤ 30 rows excluding self, banned, blocked, already-connected (same kind).
- AC2 Unit tests for `lib/matching.ts` match SQL results on a fixture of 10 profiles.
- AC3 Each card shows up to 3 reason chips.
**S3.4 — As a user, I want to send an exchange request.** [discover.spec.ts]
- AC1 Mode chips on discover; request form has kind; accept creates `exchange` connection.

## M4 — Together: rooms & events
**S4.1 — As a user, I want to host or join an online group focus room.** [together.spec.ts]
- AC1 Create with title, time, duration, capacity 2–12, language, weekly repeat.
- AC2 Join is instant until capacity; then "full".
- AC3 Room uses the shared-room UI for N participants; video optional, camera off by default.
**S4.2 — As a verified user, I want to post a "let's go together" event.** [together.spec.ts]
- AC1 Only `verified_id` users can create events; others see "تأیید هویت لازم است" with link to `/verify`.
- AC2 Join requests need host approval; approved members get a group chat.
- AC3 Blocked users cannot see or join each other's events.
**S4.3 — As an admin, I want to moderate rooms and events.** [admin.spec.ts]
- AC1 Admin can hide/cancel; members are notified.

## M5 — Safety & languages
**S5.1 — As a user meeting in person, I want safety guidance and a safety check-in.** [safety.spec.ts, sql/safety.sql]
- AC1 First in-person action shows the safety card; must tap "متوجه شدم".
- AC2 In-person sessions require both phones verified; events require host ID verified.
- AC3 Safety check push at planned end + 15 min; "problem" creates a `safety` report and notifies admins; no answer in 2 h → `no_answer` and admin alert.
**S5.2 — As a user, I want to share my session with a trusted contact.** [safety.spec.ts]
- AC1 Up to 3 contacts; "share" sends SMS/email with partner first name, place, start/end time; never the partner's phone.
**S5.3 — As a user, I want the app in Persian, English or Dutch.** [i18n.spec.ts]
- AC1 Locale switch in onboarding and profile; persists in `profiles.locale` and cookie.
- AC2 `dir` switches; no hard-coded Persian strings remain in components (lint script greps for Arabic-script characters outside `messages/`).
- AC3 Dates: Jalali for fa, Gregorian for en/nl.
**S5.4 — As a new user, I accept the community rules.** — checkbox in onboarding (18+, not for dating, respect, no-shows hurt); `accepted_rules_at` set.

## M6 — Mentor money & launch readiness
**S6.1 — As a mentor, I want weekly slots that mentees book and pay for.** [mentor.spec.ts]
- AC1 Mentor manages slots in profile; mentee sees next 14 days of free slots in their own TZ.
- AC2 Booking holds the slot 15 min; payment success → `planned` session; expiry frees it.
**S6.2 — As a mentor, I want payouts.** [payments tests]
- AC1 Stripe Connect Express onboarding link; transfers net of fee after session done.
- AC2 IRR payouts listed for admin to mark paid manually.
**S6.3 — As an admin, I want refunds.** — Stripe refund via API; Zarinpal marked refunded manually; mentee notified.
**S6.4 — As the owner, I want rate limiting, error tracking and analytics.** — OTP, requests, messages, reports rate-limited per user/IP (Upstash); Sentry captures server/client errors; PostHog events `signup, onboarding_done, request_sent, request_accepted, session_scheduled, session_done, review_left` (opt-in consent banner in EU).
**S6.5 — As the owner, I want a production deploy.** — Vercel + Supabase prod, crons configured, Jitsi domain set, Capacitor Android build pointing to prod, store listing text in fa/en/nl.
