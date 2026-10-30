# 08 — Trust, Safety & Privacy

Hamrah connects strangers, sometimes in person. Trust features are product features, not extras. When a story is ambiguous, choose the safer behaviour and log the question in `OPEN-QUESTIONS.md`.

## Community rules (shown in onboarding, `/safety`, store listing)
1. You must be 18+.
2. Hamrah is for doing things together — not for dating or romantic contact.
3. Be on time; cancel early if you can't come.
4. Meet in public places. Never share your home address before you know someone well.
5. No harassment, hate, spam, sales pitches, or requests for money outside Hamrah's payment flow.
6. Report anything that feels wrong — reports are reviewed by a human.

## Verification levels
| Badge | How | Unlocks |
|---|---|---|
| Email ✓ | OTP | basic use |
| Phone ✓ | SMS OTP | in-person sessions (both sides) |
| ID ✓ | KYC: national ID / passport + selfie reviewed by admin, or Persona | hosting events; ranking bonus; mentor "verified" label |

## Existing controls (v1, keep)
Report (harassment, spam, no_show, fake_profile, safety, other) · block (hides everywhere, prevents requests/messages) · reviews only after a done session · admin bans (`/banned`) · trust columns not user-writable · KYC files private, 10-min signed URLs · OTP hashing and attempt limits.

## New controls
| Control | Milestone |
|---|---|
| Late-cancel tracking (private to user; admin sees pattern) | M1 |
| Notes are private; partner never receives them | M2 |
| Review only between actual participants of a done session | M2 |
| Event hosts must be ID-verified; approval required by default | M4 |
| Blocks apply to groups (cannot join each other's rooms/events; host-blocked users invisible) | M4 |
| In-person: both phones verified, safety card, safety check-in, trusted contact share | M5 |
| Rules acceptance timestamp | M5 |
| Rate limits on OTP, requests (20/day), messages (60/min), reports (10/day), group creation (5/day) | M6 |

## Admin workflows
- **Reports queue:** open → reviewing → resolved/dismissed with resolution note; actions: warn (message from "تیم همراه"), ban, hide event/room. `safety` reports and safety-check "problem" answers are pinned to the top and pushed to all admins.
- **KYC queue:** approve / reject with reason; images via signed URL only; reject reasons are templated.
- **Escalation:** if a report describes immediate danger, the UI tells the reporter to contact local emergency services (112 in NL/EU, 110/115 in Iran) — Hamrah cannot dispatch help.

## Privacy
- Data minimisation: no photos (emoji avatars), city only, no birthdate except inside KYC.
- Phone numbers and emails are never shown to other users.
- KYC documents: delete images 90 days after decision (cron), keep only status — implement in M5.
- Export & delete: existing `/api/account` must include every new table (sessions participants, groups, trusted contacts, safety checks).
- GDPR: EU users get a privacy page (fa/en/nl), cookie/analytics consent (M6). Iranian SMS provider receives only the phone number and code.
- Location: event `place` is free text visible only to approved members; never geolocate users.
