# 04 — Data Model

Existing tables are defined in `supabase/migrations/001…003`. **Never edit those files.** Every change is a new numbered migration (`004_…sql`, `005_…`), idempotent where possible, with RLS enabled on every new table and policies written in the same file.

Conventions: `uuid` PKs via `gen_random_uuid()`, `created_at timestamptz default now()`, text enums via `check (x in (...))`, money in minor units (cents / rial), times stored as `timestamptz` (UTC), user time zones as IANA names.

---

## Existing (summary)
| Table | Key columns | Notes |
|---|---|---|
| `profiles` | id(=auth.users), name, avatar, city, bio, interests[], teach_langs[], learn_langs[], mode, is_mentor, mentor_price, mentor_currency, mentor_bio, mentor_topics[], verified_email/phone/id, kyc_status, rating_avg, rating_count, is_admin, is_banned | trust columns not user-writable |
| `goals` | user_id, title, category, mode, per_week 1–7, level light/medium/serious, progress 0–100 | |
| `requests` | from_user, to_user, goal_id, message, status pending/accepted/rejected | one pending per pair |
| `connections` | user_a < user_b, kind buddy/mentorship, status active/ended | unique (a,b,kind) |
| `messages` | connection_id, sender, body ≤2000 | realtime |
| `sessions` | connection_id, host, starts_at, planned_min, actual_min, status planned/done/cancelled, checkin, notes, wrapup | |
| `reviews` | connection_id, reviewer, reviewee, rating 1–5, comment, tags[] | trigger updates profile rating |
| `reports`, `blocks`, `kyc_submissions`, `otp_codes`, `push_subs`, `native_push_tokens`, `payments` | see migrations | |

---

## 004_scheduling.sql — M1
```sql
alter table public.sessions drop constraint if exists sessions_status_check;
alter table public.sessions add constraint sessions_status_check
  check (status in ('proposed','planned','live','done','cancelled'));
alter table public.sessions
  add column if not exists mode text not null default 'online' check (mode in ('online','inperson')),
  add column if not exists place text check (char_length(place) <= 120),
  add column if not exists goal_id uuid references public.goals on delete set null,
  add column if not exists series_id uuid,
  add column if not exists cancelled_by uuid references public.profiles on delete set null,
  add column if not exists cancel_reason text check (char_length(cancel_reason) <= 300),
  add column if not exists late_cancel boolean not null default false,
  add column if not exists reminded_24h_at timestamptz,
  add column if not exists reminded_15m_at timestamptz;
-- 'host' keeps meaning "who created/proposed it".

create table public.session_series (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.connections on delete cascade,
  created_by uuid not null references public.profiles on delete cascade,
  weekdays int[] not null check (weekdays <@ array[0,1,2,3,4,5,6]),  -- 0 = Sunday
  start_local time not null,
  timezone text not null,
  planned_min int not null check (planned_min between 5 and 240),
  until_date date, occurrences int check (occurrences between 1 and 52),
  created_at timestamptz not null default now()
);

alter table public.connections
  add column if not exists ended_by uuid references public.profiles on delete set null,
  add column if not exists ended_at timestamptz;
```
RPCs (all `security definer`, check `auth.uid()` is a participant, `revoke ... from public, anon`):
- `propose_session(p_conn, p_starts_at, p_planned_min, p_mode, p_place, p_goal, p_series jsonb default null) returns setof uuid` — inserts one row (`proposed`) or expands a series (max 12 rows ahead; a cron tops up the series weekly). Inserts a chat message of type session card (see `messages.meta` below).
- `respond_session(p_session, p_accept boolean, p_reason text)` — only the non-host participant; `proposed → planned | cancelled`. Accepting the first of a series accepts the series.
- `cancel_session(p_session, p_reason)` — either participant; sets `late_cancel` if `starts_at - now() < interval '2 hours'`.
- `end_connection(p_conn)` — either participant; status `ended`, future planned sessions cancelled.

`messages` gets `meta jsonb not null default '{}'` (e.g. `{"type":"session","session_id":"…"}`) so chat can render cards. Users may insert only `{}`; server/RPCs write typed meta (column grant + check in policy).

Reminders: route `POST /api/cron/reminders` guarded by `CRON_SECRET`, called every 5 min (Vercel Cron or Supabase `pg_cron` + `pg_net`). Selects planned sessions needing 24 h / 15 min reminders, sends push, stamps `reminded_*_at` (idempotent).

## 005_shared_room.sql — M2
```sql
create table public.session_participants (
  session_id uuid not null references public.sessions on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  joined_at timestamptz,
  checkin jsonb not null default '{}',      -- {goal, why, blocker}
  wrapup jsonb not null default '{}',       -- {did, next, tasks_done[]}
  moved_goal_id uuid references public.goals on delete set null,
  completed_at timestamptz,
  primary key (session_id, user_id)
);
alter table public.sessions
  add column if not exists live_state jsonb not null default '{}', -- {running, started_at, paused_elapsed_s, planned_min, half}
  add column if not exists started_at timestamptz,
  add column if not exists ended_at timestamptz;
alter table public.goals
  add column if not exists target_sessions int not null default 8 check (target_sessions between 1 and 500),
  add column if not exists completed_sessions int not null default 0;
-- trigger before insert on goals: target_sessions := per_week * 4 unless explicitly given;
-- backfill: update goals set target_sessions = per_week * 4;
-- target_sessions becomes user-writable (column grant) so the goal form can edit it.
-- backfill: every existing session gets its host as a participant with checkin/wrapup copied.
```
- Participants: for 1:1 sessions both connection members are inserted when the session is created (trigger). Private per-user fields (personal checklist, notes) stay client-side or in `session_participants.wrapup` — notes are **not** visible to the partner.
- RLS: participants read all rows of their session; each user updates only their own row.
- RPCs: `room_start(p_session)`, `room_timer(p_session, p_action text)` (`start|pause|reset|set_minutes|switch_half`) — writes `live_state` using `now()` (server clock), returns new state; client also broadcasts it on the Realtime channel. `room_wrapup(p_session, p_wrapup jsonb, p_goal uuid)` — stores wrap-up, bumps `goals.completed_sessions` and `progress = least(100, round(100*completed/target))` when `p_goal` is the caller's goal; marks session `done` when all participants completed.
- `finalize_sessions()` — cron: `live` sessions past planned end + 30 min → `done` if timer ran ≥ 1 min, else `cancelled`.
- View `user_weekly_activity(user_id, week_start, sessions_done, minutes)` for streaks.
- `reviews_insert` policy: keep "done session exists in connection" and additionally require reviewer and reviewee both in `session_participants` of a done session.

## 006_exchange_matching.sql — M3
```sql
alter table public.profiles
  add column if not exists teach_skills text[] not null default '{}',
  add column if not exists learn_skills text[] not null default '{}',
  add column if not exists timezone text not null default 'Europe/Amsterdam',
  add column if not exists availability text[] not null default '{}'; -- subset of AVAILABILITY slot keys
-- grant insert/update on these four columns to authenticated
alter table public.connections drop constraint if exists connections_kind_check;
alter table public.connections add constraint connections_kind_check check (kind in ('buddy','exchange','mentorship'));
alter table public.requests add column if not exists kind text not null default 'buddy' check (kind in ('buddy','exchange'));
```
- `accept_request` creates the connection with `r.kind`.
- Availability slot keys: `wd_morning, wd_afternoon, wd_evening, we_morning, we_afternoon, we_evening` (wd = Mon–Fri, we = Sat–Sun, in the user's own time zone; overlap is computed after converting both to UTC hours).
- `suggest_people(p_kind text default null, p_limit int default 30) returns table(profile profiles, score int, reasons text[])` — SQL port of `matchScore` v2 (see `05-ARCHITECTURE.md` §Matching), excluding self, banned, blocked, and existing active connections of the same kind. `reasons` feed the UI chips ("هر دو صبح‌ها آزاد", "هلندی ↔ فارسی").

## 007_groups_events.sql — M4
```sql
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('room','event')),
  host uuid not null references public.profiles on delete cascade,
  title text not null check (char_length(title) between 3 and 80),
  description text check (char_length(description) <= 1000),
  category text not null,
  language text,
  mode text not null check (mode in ('online','inperson')),   -- room ⇒ online
  city text, place text check (char_length(place) <= 120),
  starts_at timestamptz not null,
  duration_min int not null check (duration_min between 15 and 600),
  capacity int not null check (capacity between 2 and 50),
  approval_required boolean not null default false,          -- events default true
  weekdays int[],                                            -- recurring rooms
  external_url text, cost_note text check (char_length(cost_note) <= 120),
  status text not null default 'open' check (status in ('open','full','cancelled','done','hidden')),
  created_at timestamptz not null default now(),
  check (kind = 'event' or mode = 'online')
);
create table public.group_members (
  group_id uuid not null references public.groups on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  role text not null default 'member' check (role in ('host','member')),
  status text not null default 'approved' check (status in ('requested','approved','declined','left','removed')),
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
alter table public.messages alter column connection_id drop not null,
  add column if not exists group_id uuid references public.groups on delete cascade,
  add constraint messages_one_parent check (num_nonnulls(connection_id, group_id) = 1);
alter table public.sessions alter column connection_id drop not null,
  add column if not exists group_id uuid references public.groups on delete cascade,
  add constraint sessions_one_parent check (num_nonnulls(connection_id, group_id) = 1);
alter table public.reviews alter column connection_id drop not null,
  add column if not exists group_id uuid references public.groups on delete cascade,
  add constraint reviews_one_parent check (num_nonnulls(connection_id, group_id) = 1);
```
- Helper `is_group_member(p_group)` (approved members + host). Update `messages`, `sessions`, `reviews` policies to accept either parent.
- RPCs: `join_group(p_group)` (respects capacity, approval, blocks with host), `decide_member(p_group, p_user, p_approve)` (host only), `leave_group(p_group)`, `cancel_group(p_group)` (host or admin).
- Event hosts must have `verified_id`; room hosts must have `verified_email or verified_phone`.

## 008_safety_i18n.sql — M5
```sql
alter table public.profiles
  add column if not exists locale text not null default 'fa' check (locale in ('fa','en','nl')),
  add column if not exists accepted_rules_at timestamptz;
create table public.trusted_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  channel text not null check (channel in ('email','sms')),
  value text not null,
  created_at timestamptz not null default now()
); -- RLS: owner only. Max 3 per user (trigger).
create table public.safety_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  session_id uuid references public.sessions on delete cascade,
  group_id uuid references public.groups on delete cascade,
  status text not null default 'pending' check (status in ('pending','ok','problem','no_answer')),
  answered_at timestamptz,
  created_at timestamptz not null default now()
); -- RLS: owner read/update own; admin read.
```
A `problem` answer auto-creates a `reports` row with reason `safety` and alerts admins.

## 009_mentor_payouts.sql — M6
```sql
create table public.mentor_slots (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references public.profiles on delete cascade,
  weekday int not null check (weekday between 0 and 6),
  start_local time not null, timezone text not null,
  duration_min int not null default 50 check (duration_min between 15 and 180),
  active boolean not null default true
);
alter table public.payments add column if not exists session_id uuid references public.sessions on delete set null;
create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references public.profiles on delete cascade,
  amount int not null check (amount > 0), currency text not null,
  provider text not null check (provider in ('stripe_connect','manual')),
  provider_ref text, period_start date, period_end date,
  status text not null default 'pending' check (status in ('pending','paid','failed')),
  created_at timestamptz not null default now()
); -- RLS: mentor reads own, admin all; writes server-only.
create table public.private_profile (
  id uuid primary key references public.profiles on delete cascade,
  stripe_account_id text
); -- no user policies; service role only.
```
Booking a slot reserves it for 15 min (`sessions` row `proposed`, linked from `payments.session_id`); payment success → `planned`; expiry → deleted.

---

## Entity relationship (target)
```
profiles 1─* goals
profiles *─* profiles  via requests ─► connections (buddy|exchange|mentorship)
connections 1─* messages, sessions, reviews
sessions 1─* session_participants *─1 profiles
session_series 1─* sessions
groups (room|event) 1─* group_members, messages, sessions, reviews
payments ─► connections / sessions ; payouts ─► profiles(mentor)
profiles 1─* reports, blocks, kyc_submissions, push tokens, trusted_contacts, safety_checks
```
