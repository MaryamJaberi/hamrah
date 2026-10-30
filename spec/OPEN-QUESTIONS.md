# Open Questions

Decisions the owner (Maryam) has not made yet. The agent must **not** decide these silently: use the stated default, mark the code with `// DECISION: Qn`, and continue. New questions are appended at the bottom with the date.

| # | Question | Default until decided | Affects |
|---|---|---|---|
| Q1 | Launch market first: Persian speakers in the Netherlands, in Iran, or both at once? | Both; fa default locale, EU hosting | M5, M6, marketing |
| Q2 | Is "Hamrah Plus" subscription wanted? What would it include? | Not built | — |
| Q3 | Max group size for focus rooms | 12 | M4 |
| Q4 | Allow profile photos? (trust ↑, moderation & privacy cost ↑) | No, emoji avatars only | M3+ |
| Q5 | IRR mentor payouts: manual by admin via a payment agent, or not offered? | Manual list for admin | M6 |
| Q6 | Video provider for launch: self-hosted Jitsi, JaaS (8x8), or Daily/LiveKit? | JaaS via `NEXT_PUBLIC_JITSI_DOMAIN` | M2, M6 |
| Q7 | Are Vercel, Supabase and the video provider reachable from Iran without a VPN? Need an Iran-hosted mirror/proxy? | Test before launch; no mirror built | M6 |
| Q8 | Android distribution in Iran (Google Play often unavailable): direct APK page, Cafe Bazaar, Myket? | Direct APK download page | M6 |
| Q9 | Should no-shows / late cancels lower ranking publicly? | Private only; admin sees patterns | M1, M3 |
| Q10 | Final brand: name "همراه / Hamrah" vs "BodyDouble"; relation to umbrella brand SoloNovate | "همراه" in app, "Hamrah" in Latin | all |
| Q11 | Bottom nav in v2: replace "هدف‌ها" with "جمع" (proposed) | Replace in M4 | M4 |
| Q12 | Interests list: keep v1's 16 or expand per market? | Keep, add "نوشتن" and "کار اداری" | M3 |

## Resolved 2026-10-30 (after agent read-through)
- Group chats use `group_id` on messages/sessions/reviews (04), not a `group` connection kind.
- `requests.kind` is `buddy | exchange` only; mentorship opens via /mentors and /u/[id].
- `target_sessions` = per_week × 4 on insert + backfill; user-editable.
- No "first wrap-up + 15 min" rule; finalize at all wrap-ups or planned end + 30 min.
- Slot booking link is `payments.session_id`.
- No "make admin" UI; admins are created via the seed script only.
- Two-way block hiding on discover is fixed in M0 (G15).

## Agent-added questions
<!-- append: | Qxx | question | default used | where | (YYYY-MM-DD) -->
