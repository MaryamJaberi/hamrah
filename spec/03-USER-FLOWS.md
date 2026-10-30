# 03 — User Flows

Legend: ✅ exists in v1 · 🆕 to build (milestone in brackets).

## F1 Sign-up & onboarding ✅
1. `/login`: choose email or phone. Phone accepts `09…` (→ +98), `06…` (→ +31), or `+…`; Persian digits allowed.
2. 6-digit code (email via Supabase template, SMS via Kavenegar for +98, Twilio otherwise). 5 attempts, rate-limited.
3. No profile → `/onboarding` (3 steps): name/city/avatar → ≥2 interests → teach/learn languages + mode.
4. A first goal "تمرین {first interest}" is created; redirect `/discover`.
5. 🆕 [M3] Step 3 also asks: time zone (auto-detected), availability ("mornings / afternoons / evenings / weekends"), and skills to teach/learn.
6. 🆕 [M5] Step 0 shows locale switcher (fa / en / nl) and community rules checkbox ("I am 18+, Hamrah is not for dating").

## F2 Discover → Request → Connect ✅
1. `/discover`: incoming requests on top (accept → chat; reject), then ranked suggestions with match %.
2. Request form: optional goal + message (prefilled).
3. Recipient gets push; accept runs `accept_request()` → connection + first message.
4. 🆕 [M3] Request carries a **kind** (`buddy | exchange`); suggestions are filterable by mode chips at the top. Mentorship is not requested here — it opens via `/mentors` and `/u/[id]` (free or paid).
5. 🆕 [M3] Ranking is done in SQL (`suggest_people` RPC), not on the latest 100 profiles.

## F3 Chat ✅
Realtime messages per connection; header links to room and profile; safety menu (report/block).
🆕 [M1] "📅 Schedule" button in chat header opens F4. Session proposals appear in chat as cards with Accept / Suggest another time.
🆕 [M1] "End connection" in the menu (sets `connections.status = 'ended'`, hides from lists, keeps history).

## F4 Schedule a session 🆕 [M1]
1. From chat or from `/sessions`, user taps **Schedule**.
2. Picks: date, start time (shown in own time zone, partner's local time shown underneath), duration (25/50/90 or custom 5–240), mode (online/in-person), optional goal, optional place (in-person only, free text + city), recurrence (none / weekly on selected weekdays, until date or N times).
3. Creates `sessions` row(s) with `status='proposed'` and a chat card.
4. Partner accepts → `status='planned'`; declines → `cancelled` with reason; proposes another time → new proposal, old one `cancelled`.
5. Both get reminders: 24 h (if scheduled > 24 h ahead) and 15 min before; push + in-app.
6. Either can cancel up to start; cancelling < 2 h before counts as a **late cancel** (visible to the user only, used for reliability stat later).
7. "Add to calendar" downloads an `.ics` file.

## F5 Shared focus room 🆕 [M2] (replaces the single-user room)
1. Entering `/room/[sessionId]` (or `/room/now/[connectionId]` for an instant session) joins a Realtime channel `room:{sessionId}`.
2. Presence shows who is in the room (avatar + "here" / "away").
3. **Check-in**: each participant fills goal / why / possible blocker; both see each other's.
4. **Timer is shared**: start/pause/reset by either; state = `{startedAt, pausedElapsed, plannedMin, running}` broadcast + persisted to `sessions.live_state`; clients compute remaining time from server time to stay in sync.
5. Optional **exchange split** (mode exchange): timer runs in two halves with a "switch" prompt and language/skill label for each half.
6. Personal checklist + notes (private to each participant).
7. Optional video tab (Jitsi, room name `hamrah-{sessionId}`), mounted once so switching tabs does not drop the call.
8. **Wrap-up**: each writes "what I did" + "next step", and may tick "this moved my goal forward" → goal progress +1 step.
9. Session ends when all participants submit wrap-up, or by server job at planned end + 30 min (`done` if timer ran ≥ 1 min, else `cancelled`). `actual_min` = timer elapsed.
10. Review prompt for the other participant (existing `ReviewForm`).
11. In-person sessions: same room UI without video; plus safety check (F9).

## F6 Goals & progress ✅ / 🆕 [M2]
✅ Create goal (title, category, per-week, level, mode), manual ±10%.
🆕 Goal has a `target_sessions` (set to per_week × 4 on insert by trigger, editable in the goal form; existing goals backfilled the same way). Completed sessions linked to the goal advance progress automatically; manual adjust stays.
🆕 Weekly streak: a week counts if the user met ≥ 1 completed session (or the goal's per_week, shown separately). Streak shown on `/goals` and `/sessions`.

## F7 Mentorship ✅ / 🆕 [M6]
✅ Mentor toggles mentor mode in profile (price in USD/EUR/IRR, bio, topics). Free → `start_free_mentorship()`; paid → Stripe Checkout or Zarinpal → webhook/verify → connection.
🆕 [M6] Mentor publishes weekly **slots**; a mentee books a slot at checkout, so payment = one scheduled session (`payments.session_id`).
🆕 [M6] Payouts via Stripe Connect Express (EUR/USD); IRR payouts tracked manually by admin (`payouts` table) — see OPEN-QUESTIONS.
🆕 [M6] Refund: admin can refund a paid session (Stripe refund API; Zarinpal manual) → `payments.status='refunded'`.

## F8 Groups & events 🆕 [M4]
**Group focus rooms (online)**
1. `/together` (tab "اتاق‌ها") lists upcoming rooms (e.g. "صبحگاهی ۷–۸", "Pomodoro hour") with language, capacity (2–12), host.
2. Any verified-email user can host; join with one tap; room uses the same shared-room UI (F5) for N participants; video optional (camera off by default).
3. Recurring rooms (weekly) supported.

**"Let's go together" events**
1. `/together` (tab "رویدادها") lists posts: title, category, date/time, city, place name (public venue), max companions, cost note, external link.
2. User taps "I'm in" → join request; host approves.
3. Approved members get a group chat (`messages.group_id`, see `04-DATA-MODEL.md` 007 — `connections` stay 2-person).
4. Day before: reminder; in-person safety rules shown (F9).
5. After the event: members can review each other (only those who were approved).

## F9 In-person safety 🆕 [M5]
1. First time a user chooses in-person anything: a short safety card (meet in public places, tell someone, ID-verified badge meaning, report button).
2. In-person session/event requires **both** sides to have verified phone; hosts of events require verified ID.
3. Optional **trusted contact**: user saves a name + phone/email; at session start can "share my session" → SMS/email with partner first name, place, time, end time.
4. **Safety check-in** push at planned end + 15 min: "Did it go OK?" → OK / Report a problem.
5. Exact addresses are never stored in profiles; places are free-text venue names on sessions/events only, visible to participants.

## F10 Trust & safety ✅
Report (6 reasons) and block from profile/chat; blocked users disappear from discover/search and cannot message. Admin console handles reports, KYC, bans. See `08-TRUST-SAFETY.md`.

## F11 Account ✅
Export data (JSON) and delete account (`/api/account`). Push toggle (web + native).

## F12 Admin ✅ / 🆕
✅ Dashboard counters, KYC review with signed URLs, reports workflow, users (ban/unban), payments. Making someone admin is only possible via `SEED_ADMIN_EMAIL` in `scripts/seed.mjs` (no UI — intentional).
🆕 [M4] Moderate events and rooms (hide, cancel).
🆕 [M6] Refunds, payouts, metrics for north-star and activation (see `01-PRODUCT-BRIEF.md`).
