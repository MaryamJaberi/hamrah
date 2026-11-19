# 11 — Outings «بریم بیرون» (module MO) — developer spec

Source of truth for intent: `10-OUTINGS.fa.md`. This file is for developers and the coding agent. Status: **MO-1 built** on branch `mo-outings` (migration `010_outings.sql`, SQL tests, UI under `/out`).

## 1. Scope
Two paths + one helper:
1. **Group plan** (friends): organizer creates plan → invite link → members vote time slots, activities, places → app ranks best slot, suggests venues on a free map, shows icebreakers → organizer confirms → push to all.
2. **Open invite / intent** ("coffee with someone like X"): user posts activity + time window + area + wants → nearby fitting users get a push → they respond → owner accepts → a plan is created with both.
3. **Like-minded people**: ranked list with reasons; invite into one of your plans.

Plus a **conversational profile builder** (one question at a time, chat-like, skippable, editable).

## 2. Privacy invariants (must stay true — tested in `supabase/tests/010_outings_test.sql`)
- P1. No user can `select` another user's row in `outing_profiles` or `outing_lifestyle` (RLS own-row only). Others' data only through `outing_card`, `outing_lifestyle_of`, `outing_plan_detail`, `outing_matches`, `nearby_outing_intents`, `outing_intent_detail`, which mask fields.
- P2. Field visibility `vis.{age,job,hobbies,places}` ∈ public | matched | hidden. *matched* = both are `joined` members of the same non-cancelled plan and not blocked (`outing_together`).
- P3. Lifestyle (alcohol/cannabis/smoking) per field: hidden (default) | mutual. Viewer V sees T's field F iff both chose mutual for F, both answered F, and `outing_together(V,T)`.
- P4. Hidden lifestyle influences scores/venue hints only if the owner set `use_for_matching` (default false; UI warns it may be inferable).
- P5. Group `venue_hint` is empty unless the plan has ≥ 3 joined members.
- P6. `gender` is never returned by any RPC; used only for women-only filters (plans, intents, prefs).
- P7. Location stored as `numeric(5,2)` (~1 km). No exact addresses of people.
- P8. Blocked pairs (either direction) never see each other in matches/intents/plan joins.
- P9. Internal helpers `outing_score`, `outing_compatible`, `outing_fits_intent`, `outing_intent_candidates` are not executable by `authenticated` (they could be used as oracles). `outing_intent_candidates` is `service_role` only.
- P10. Users cannot write plan/slot/place/vote/member rows directly; only via RPCs. Intents: owners may only update `status` (column grant).

## 3. Data model (`010_outings.sql`)
| Table | Purpose |
|---|---|
| `outing_profiles` | per-user outing profile: birth_year, gender, job, hobbies[], activities[], places_liked[], places_been[], languages[], budget, area_label/lat/lng, radius_km, free_slots[] (`day:part`), vis jsonb, pref jsonb `{age_min,age_max,women_only,avoid:{smoking,cannabis,alcohol}}`, builder_step (99 = done) |
| `outing_lifestyle` | alcohol/cannabis/smoking (no/sometimes/yes) + `_share` hidden/mutual + use_for_matching |
| `outing_plans` | title, note, activity_options[], area, women_only, max_people, invite_code (8 chars), status collecting/confirmed/cancelled/done, chosen_slot, chosen_place, source_intent |
| `outing_plan_members` | plan_id,user_id, role organizer/member, status invited/joined/left, activities[] (my votes), area |
| `outing_plan_slots` / `outing_slot_votes` | candidate times; yes/maybe/no |
| `outing_plan_places` / `outing_place_votes` | venues (manual/osm/google) and 👍 votes |
| `outing_messages` | plan chat; `sender null` = system message; realtime publication |
| `outing_intents` / `outing_intent_responses` | open invites and "I'm in" responses |

RPCs (all `security definer`, `search_path=public`, revoked from public/anon): `outing_card`, `outing_lifestyle_of`, `outing_matches(activity,limit)`, `create_outing_plan`, `outing_plan_preview(code)`, `join_outing_plan(code)`, `leave_outing_plan`, `invite_to_outing_plan`, `outing_plan_detail`, `set_outing_activities`, `vote_outing_slot`, `add_outing_slot`, `add_outing_place`, `toggle_outing_place_vote`, `confirm_outing_plan`, `create_outing_intent`, `nearby_outing_intents`, `respond_outing_intent`, `outing_intent_detail`, `accept_outing_response`. Rate limits: 10 plans/day, 3 intents/day, ≤ 12 slots at creation, ≤ 20 slots, ≤ 30 places.

## 4. Flows
| ID | Flow | Screens |
|---|---|---|
| FO1 | Build profile conversationally (skip / edit any answer; per-field visibility; lifestyle hidden/mutual) | `/out/profile` |
| FO2 | Create plan → share link (Web Share / copy) | `/out/new` → `/out/p/[id]?new=1` |
| FO3 | Join by link (logged-out user: login → onboarding → returns to link via `hamrah_next` cookie) | `/out/join/[code]` |
| FO4 | Vote slots, add slot, vote activities | `/out/p/[id]` tabs کِی / چی |
| FO5 | Venues: map of group center, OSM suggestions for chosen activity, add to group, 👍 vote, manual add | tab کجا |
| FO6 | Members with masked cards + mutual lifestyle | tab کی‌ها |
| FO7 | Icebreakers from shared hobbies + activity + games | tab یخ‌شکن |
| FO8 | Realtime plan chat with system messages | tab گفتگو |
| FO9 | Organizer confirms slot (+place) → system msg + push | bottom card |
| FO10 | Leave plan / organizer cancels | bottom link |
| FO11 | Post open invite → push to ≤30 nearby fitting users | `/out/intent/new` → `/out/i/[id]` |
| FO12 | See nearby invites, respond "I'm in" with message → push owner | `/out` → `/out/i/[id]` |
| FO13 | Owner accepts responder → plan created/extended → both in plan | `/out/i/[id]` → `/out/p/[id]` |
| FO14 | Like-minded list (filter by activity) → invite to a collecting plan → push | `/out/people` |

## 5. User stories & acceptance criteria
| ID | Story | Acceptance criteria | Test |
|---|---|---|---|
| SO1 | As a user I build my outing profile by answering one question at a time | each answer saved on "بعدی"; "رد شو" skips; tapping an answer bubble reopens it; completion sets builder_step 99 | e2e `outings.spec.ts` buildProfile |
| SO2 | I choose who sees my age/job/hobbies/places | hidden field never in `outing_card`; matched field only after joining same plan | SQL test (job hidden→shown, age hidden) |
| SO3 | I keep alcohol/cannabis/smoking private or share mutually | hidden never shown; mutual shown only to mutual co-members | SQL test (alcohol shown, smoking hidden) |
| SO4 | I create a plan with candidate times and get an invite link | plan + organizer member + slots + system msg created; link copyable/shareable | SQL + e2e |
| SO5 | Friends join through the link | joined; women-only refuses non-women; full/closed refused; blocked refused | SQL (man, blocked) + e2e (man refused) |
| SO6 | Members vote times and see the best one | counts, names of yes-voters; best = max(yes + maybe/2) highlighted | SQL (vote counted) + e2e |
| SO7 | Members pick activities and places; map suggests venues near the group | tally shown; OSM suggestions; add/vote; alcohol-free filter when hint set (≥3 members) | SQL (hint empty <3) |
| SO8 | Organizer confirms and everyone is notified | only organizer; slot/place must belong to plan; status confirmed; system msg; push | SQL (non-organizer refused) |
| SO9 | I see icebreakers that fit the group | ≥ 8 items; includes shared-hobby questions when ≥2 members share a hobby; reshuffle | unit (manual) |
| SO10 | I post "coffee with someone like X" and nearby fitting people are notified | intent created; candidates = fits (women-only, age, distance, blocks, compat); push once (notified_at) | SQL (man doesn't see women-only) |
| SO11 | I respond to an invite; the owner accepts me and we get a plan | respond only if fits & open; owner-only accept; plan auto-created; intent matched when full | SQL |
| SO12 | I browse like-minded people with reasons and invite them | ranked by score; reasons from public fields only; invite requires compat + women-only | SQL (blocked excluded) |
| SO13 | Non-members can't read anything of a plan | plans/members/slots/places/messages invisible; insert message refused | SQL |

## 6. Map & places (free by default)
- Tiles: OpenStreetMap standard tiles (attribution shown). Optional `NEXT_PUBLIC_MAPTILER_KEY` switches to MapTiler (free tier 100k loads/month).
- Venue search `/api/out/places`: Overpass API (two mirrors, 12 s timeout, cached 6 h) → fallback Photon. Optional `GOOGLE_PLACES_KEY` uses Google Places (New) Text Search first.
- Geocoding in `AreaPicker`: Photon from the browser; "use my location" rounds to 2 decimals.
- Directions: plain `google.com/maps/dir` link (no API).
- Note: OSM tile usage policy forbids heavy use; before public launch switch to MapTiler or a self-hosted tile server (Q18).

## 7. Files
`supabase/migrations/010_outings.sql`, `supabase/tests/010_outings_test.sql`, `lib/outings.ts`, `lib/places.ts`, `lib/icebreakers.ts`, `components/{OutCard,AreaPicker,LeafletMap}.tsx`, `app/(app)/out/**`, `app/api/out/{places,notify}/route.ts`, `e2e/outings.spec.ts`, `middleware.ts` (invite return cookie), `components/Nav.tsx` (tab «بیرون»). Dependency added: `leaflet` (+ `@types/leaflet`).

## 8. Next (MO-2)
Reminders (needs M1 cron), post-outing feedback → auto-fill `places_liked`, safety check-in (needs M5), recurring monthly plans, AI interview builder (Q15), i18n of the module (M5), admin view of reported plans.
