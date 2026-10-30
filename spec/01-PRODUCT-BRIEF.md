# 01 — Product Brief (agent-facing)

The Persian concept doc `00-CONCEPT.fa.md` is the source of truth for intent. This file restates it in English for the coding agent. If they disagree, `00-CONCEPT.fa.md` wins — record the conflict in `OPEN-QUESTIONS.md`.

## One-liner
**Hamrah (همراه, "companion")** — a mobile-first, Persian-first platform for finding a real person to do things *with*: focus sessions (body doubling), skill & language exchange, mentorship, and going to events together.

## Problem
People start and finish more when someone else is present. Existing productivity apps are tools without people; social/meetup apps are people without structure, trust, or follow-up. Persian speakers in Iran and the diaspora (esp. Netherlands/Europe) also lack local-language tools, local SMS login, and payment rails that work on both sides.

## Users / personas
| Persona | Need | Primary mode |
|---|---|---|
| Sara, grad student, Rotterdam | 3 × 50-min online focus sessions per week for her thesis | Body doubling |
| Omid, developer, Tehran | Practice Dutch; can teach Python & Persian | Exchange |
| Nasrin, newcomer, Amsterdam | Someone safe to go to concerts / yoga with | Events (in-person) |
| Reza, senior designer, Berlin | Offer free + paid mentorship, paid from Iran and EU | Mentorship |
| Admin | KYC review, reports, bans, health metrics | Admin console |

## Four modes
| Key | Name (fa) | What it is | Online / in-person |
|---|---|---|---|
| `buddy` | همراه کار | Two people work on their own tasks in a timed, structured session | both |
| `exchange` | تبادل | Each teaches the other a language or skill; session split in halves | both |
| `mentorship` | منتورشیپ | One guides the other; free or paid | both |
| `group` / `event` | جمع و رویداد | Open group focus rooms (online only) and "let's go together" event posts | rooms: online; events: in-person or online |

## Core loop
Goal → Discover (match score) → Request → Accept → Chat → **Schedule** → **Shared Room** → Wrap-up → Review → Goal progress & streak → next scheduled session.
Bold steps are not built yet (see `02-CURRENT-STATE.md`).

## Differentiators
1. Sessions, not just chat — every connection leads to a structured, measurable session.
2. Persian-first, Iran ↔ Europe bridge — RTL, Jalali dates, Kavenegar + Twilio OTP, Zarinpal + Stripe.
3. Layered trust — email/phone/ID verification, reviews only after a real session, report/block, in-person safety rules.
4. One profile, four needs.

## Design principles
- Mobile-first: 480 px app column, bottom nav, one main action per screen.
- Warm, non-judgemental copy (Persian, informal "تو" register).
- Privacy by default: city not address; phone never shown; KYC files admin-only via 10-min signed URL.
- Accessible: WCAG 2.1 AA, axe checks in E2E.
- Locales: `fa` (default, RTL), `en`, `nl`.

## Business model
- Platform fee on paid mentorship (`PLATFORM_FEE_PERCENT`, default 15) — exists.
- "Hamrah Plus" subscription — undecided, do not build (see OPEN-QUESTIONS).

## Success metrics
- North star: completed sessions per week.
- Activation: % of new users completing a first session within 7 days.
- Match: request acceptance rate.
- Retention: % of pairs with a 2nd session; week-4 return.
- Trust: reports per 100 sessions; mean rating.

## Out of scope
Public social feed; dating (explicitly forbidden in community rules); users under 18; recording calls.
