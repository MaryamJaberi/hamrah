---
name: hamrah-qa-and-i18n
description: Product QA, safety/inclusivity checklist, and multi-language (fa/en/nl) architecture guide for Hamrah (همراه) recurring friendship meetups and Dorehami (/d).
---

# Hamrah Product QA, Safety & Multi-Language Skill

## Core Product Philosophy (The 200-Hour Rule)
- Adult friendship requires shared recurring hours (~50h casual friend, ~90h friend, ~200h close friend).
- Prioritize **recurring rituals** (`weekly` / `biweekly` + day/time slot) over one-off "let's hang out sometime" plans.
- **Zero-friction entry**: Guests land directly on `/d` without a login wall; login (Google OAuth when enabled, Email/Phone Password or OTP) is deferred until the end of the flow.
- **Judgment-free safety & privacy**:
  - Never force gender disclosure.
  - Support inclusive preferences (`any`, `same_gender`, `women_only`, `men_only`, `lgbtq_safe`).
  - Support real-world lifestyle & comfort tags (`no_smoke`, `no_alcohol`, `veg`, `nl_friendly`, `adhd_friendly`, `quiet`, `no_photo`) and **private link-only** visibility (`visibility: 'private'`).
  - Support language-practice matching (`nl_native`, `nl_practice`, `en_native`, `en_practice`, `fa`).
  - **Double-Blind Private Challenges (`private_challenges`)**: Users can privately select shared struggles (`weight_journey`, `adhd`, `social_anxiety`, `new_in_town`, `hard_season`, `habit_reset`, `low_energy`) in their profile. `GET /api/d/profiles` MUST strip `private_challenges`, and it MUST NEVER be added to `public_fields`. Only `POST /api/d/mutual-match` computes server-side intersections, revealing ONLY mutually selected challenges alongside shared cities, shared hobbies, and boundary-compatible (smoke/alcohol) matches.

## Data Model Contract (i18n-Ready)
Always store language-agnostic enum keys in `dh_meetups.final` metadata (never localized prose) so events translate automatically when the UI expands to `en` and `nl`:
- `final.rhythm`: `{ freq: 'weekly' | 'biweekly' | 'once', day?: string, slot?: string }`
- `final.location`: `{ mode: 'flexible' | 'area' | 'exact', city?: string, city_label?: string, radius_km?: number, place?: string }`
- `final.audience`: `{ visibility: 'public' | 'nearby' | 'private', smoke?: 'any' | 'no_smoke' | 'ok', alcohol?: 'any' | 'no_alcohol' | 'ok', gender_pref?: 'any' | 'same_gender' | 'women_only' | 'men_only' | 'lgbtq_safe', lang?: 'any' | 'nl_native' | 'nl_practice' | 'en_native' | 'en_practice' | 'fa', tags?: ('veg' | 'nl_friendly' | 'adhd_friendly' | 'quiet' | 'no_photo')[] }`
- `isFinalized(final)` MUST check `Boolean(final && (final.d || final.venue || final.city))` so metadata keys never trigger a fake "قطعی شد" card.

## Multi-Agent QA Protocol
Before merging significant `/d` changes, run 2–3 specialized checks:
1. **Logic & Persistence Check**: Verify `npm run typecheck`, `npm run build`, and Playwright tests in both live-DB mode and CI placeholder mode (`NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co`).
2. **Mobile Visual & UX Critic (390×844)**: Verify 1-row scrollable idea chips, no horizontal clipping on tabs or buttons, RTL/LTR bidi safety, and clear empty states.
3. **i18n & Safety Readiness Check**: Ensure new options use enum keys in API/DB, private events are filtered from `/api/d/profiles`, and no user is forced to disclose sensitive personal info.
