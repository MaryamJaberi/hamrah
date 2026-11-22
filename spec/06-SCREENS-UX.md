# 06 — Screens & UX

## Visual system (keep from v1)
| Token | Value | Tailwind |
|---|---|---|
| Primary | `#6C5CE7` | `primary` |
| Primary soft | `#EEEBFF` | `primary-soft` |
| Accent (success) | `#00B894` | `accent` |
| Accent soft | `#E1F7F0` | `accent-soft` |
| Warn / danger | `#E5484D` | `warn` |
| Warn soft | `#FFECEC` | `warn-soft` |
| Ink | `#17172A` | `ink` |
| Muted | `#6B6B82` | `muted` |
| Line | `#E9E9F2` | `line` |
| Background | `#F4F4FA` | body |
Font: Vazirmatn (all locales; Latin glyphs included). Radius: cards 16 px (`rounded-2xl`), buttons 16 px, chips full. Component classes in `app/globals.css`: `.card .btn .btn-sm .btn-sec .btn-ghost .btn-danger .chip .chip-on .chip-accent .chip-ghost .input .label .section .page .h1`. Reuse them; add new classes there, not ad hoc.

Avatars are emoji (no photo uploads in v2 — privacy and moderation cost; see OPEN-QUESTIONS Q4).

Direction: `dir="rtl"` for `fa`, `ltr` for `en`/`nl` (set on `<html>` from locale). Use logical Tailwind props (`ps-`, `pe-`, `ms-`, `start-`, `end-`) in new code. Timer digits and phone numbers `dir="ltr"`.

Tone: informal Persian ("تو"), short, encouraging. Never shame missed sessions; say "این هفته هنوز جلسه‌ای نداشتی — یکی بذاریم؟".

## Visual designs (Nov 2026)
Mockups for the screens that are not built yet live on one design canvas: https://claude.ai/artifact/BySbBKsKtPxbcyF3czEths
A copy is in the repo: `design/2026-11-screens/` (open `index.html`; PNGs in `png/` for agents that read images).
- Row 1, M1–M2: Sessions (upcoming + streak), schedule form, shared room, wrap-up sheet.
- Row 2, M4–M5: Together hub (events/rooms), event detail with safety card, create room/event, safety & rules (+ trusted contacts).
- Row 3, MO-2: reminder + "همه‌چیز خوبه؟" safety check-in, post-outing feedback, monthly recurring plan.
They use the v1 tokens above and Vazirmatn. Two deliberate differences from v1: icons are line SVGs (not emoji), and avatars are a coloured circle with the first letter. Build from these; where a mockup and this spec disagree, the spec wins and the mockup gets fixed.

## Navigation (bottom bar, 5 items)
v1: کشف · هدف‌ها · جلسه‌ها · چت · من
v2 (M4): **کشف · جلسه‌ها · جمع · چت · من** — goals move into "من" as a tab and into the session/wrap-up flow; "جمع" = rooms + events. Badge on چت for unread, on کشف for incoming requests.

## Screen inventory
| Route | Purpose | Status | Key elements |
|---|---|---|---|
| `/login` | email or phone OTP | ✅ | tabs email/phone, 6-digit input (`inputmode=numeric`, Persian digits accepted) |
| `/onboarding` | 3 steps | ✅ → M3/M5 adds availability, skills, time zone, locale, rules | progress bar, chips |
| `/discover` | incoming requests + suggestions | ✅ → M3 | mode filter chips (همه / همراه کار / تبادل), match % chip, reason chips, "Request" |
| `/search` | advanced search | ✅ → M3 adds skills & availability filters | |
| `/u/[id]` | public profile | ✅ → M3 shows availability (as slot chips, not times), skills; M6 mentor slots | |
| `/chat`, `/chat/[id]` | 1:1 and group chat | ✅ → M1 session cards, schedule button, end connection; M4 group threads | |
| `/sessions` | upcoming + history + stats | ✅ → M1 **Upcoming** section on top (date, partner, accept/decline for proposals, "Join" when ≤10 min to start), streak | |
| `/sessions/new?conn=` | schedule form | 🆕 M1 | date, time (+ partner's local time), duration chips, mode, place, goal, repeat |
| `/room/[sessionId]` | shared room | ✅ single-user → 🆕 M2 shared | presence avatars, big shared timer, check-in cards for each person, private checklist & notes, video tab, wrap-up |
| `/room/now/[connId]` | instant session | 🆕 M2 | creates a `live` session, redirects to room |
| `/goals` | goals | ✅ → M2 progress from sessions, target, streak | |
| `/together` | rooms + events hub | 🆕 M4 | tabs "اتاق‌ها" / "رویدادها", "＋ بساز" |
| `/together/new` | create room or event | 🆕 M4 | |
| `/together/[id]` | room/event detail | 🆕 M4 | members, join/request, chat, safety card for in-person |
| `/profile` | edit + settings | ✅ → M3 skills/availability/TZ; M5 locale, trusted contacts; M6 mentor slots & payouts | |
| `/safety` | rules & tips | 🆕 M5 | static content, linked from in-person flows and footer of profile |
| `/verify` | KYC | ✅ | |
| `/admin/*` | console | ✅ → M4 groups moderation; M6 refunds, payouts, metrics | desktop width |

## Key screen specs

### Schedule form (M1)
```
┌─────────────────────────────┐
│ → جلسه با سارا              │
│ تاریخ   [ پنج‌شنبه ۱۵ آبان ▾ ]│
│ ساعت    [ ۰۹:۰۰ ]            │
│         ساعت سارا: ۱۲:۳۰ (تهران)│
│ مدت     (۲۵) (۵۰) (۹۰) (…)   │
│ شیوه    (آنلاین) (حضوری)     │
│ مکان    [ کتابخانه مرکزی… ]  │  ← only in-person
│ هدف     [ پایان‌نامه ▾ ]     │
│ تکرار   (یک‌بار) (هفتگی)     │
│         ش ی د س چ پ ج  تا [..]│
│ [   ارسال پیشنهاد   ]        │
└─────────────────────────────┘
```
Validation: start ≥ now + 5 min; ≤ 90 days ahead; max 12 generated occurrences.

### Shared room (M2)
Top: back, title "جلسه با سارا", presence dots (green = here, grey = away).
Timer card: `MM:SS` large, state text, Start/Pause/Reset (any participant), duration chips locked once started. Exchange mode: segmented label "نیمه اول: هلندی · نیمه دوم: فارسی" and a "Switch" button at half time.
Check-in: two cards side by side on wide, stacked on mobile — "تو" and "سارا"; partner card read-only, shows "هنوز ننوشته" until filled.
Private: checklist + notes with a 🔒 "فقط تو می‌بینی" label.
Wrap-up sheet: did / next / "این جلسه هدف «…» رو جلو برد" toggle → Save. Then review form.

### Together hub (M4)
Room card: title, time (local), language flag text, "۴/۸ نفر", host avatar, [پیوستن].
Event card: title, category chip, date, city · place name, "۲ جای خالی", cost note, verified-host badge, [منم میام] / [درخواست فرستاده شد].

## Empty states & errors
Every list has an empty state with a next action (e.g. no upcoming sessions → "با یکی از همراه‌هات یه جلسه بذار" + button). Network/RLS errors show a friendly line plus a retry; never raw SQL messages (v1 onboarding shows `error.message` — replace).

## Copy glossary (fa / en / nl)
| fa | en | nl |
|---|---|---|
| همراه | companion / Hamrah | maatje / Hamrah |
| همراه کار | focus buddy | focusmaatje |
| تبادل | exchange | uitwisseling |
| منتورشیپ | mentorship | mentorschap |
| جمع | together | samen |
| اتاق تمرکز | focus room | focuskamer |
| رویداد | event | evenement |
| جلسه | session | sessie |
| چک‌این | check-in | check-in |
| جمع‌بندی | wrap-up | afronding |
| هدف | goal | doel |
| زنجیره | streak | reeks |
| درخواست اتصال | connection request | verbindingsverzoek |
| تأیید هویت | ID verification | ID-verificatie |
| گزارش | report | melden |
| مسدود کردن | block | blokkeren |
