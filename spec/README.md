# Hamrah (همراه) — Specification Package

Spec for building Hamrah v2 on top of the existing v1 code with an AI coding agent (Google Antigravity). Version **2.0 — 2026-10-30**. Owner: Maryam Jaberi.

| # | File | What it is | Language |
|---|---|---|---|
| — | `AGENTS.md` | Hard rules for the coding agent — read first | en |
| 00 | `00-CONCEPT.fa.md` | Full product concept: problem, personas, four modes, core loop, principles, business model, roadmap | **fa** (source of truth) |
| 01 | `01-PRODUCT-BRIEF.md` | Same concept condensed for the agent | en |
| 02 | `02-CURRENT-STATE.md` | What v1 already contains, security invariants, known gaps G1–G14 | en |
| 03 | `03-USER-FLOWS.md` | Every flow, existing ✅ and new 🆕 with milestone | en |
| 04 | `04-DATA-MODEL.md` | Existing tables + migrations 004–009 (DDL, RPCs, policies) | en |
| 05 | `05-ARCHITECTURE.md` | Stack, rules, realtime room design, matching v2, notifications, cron, env, deployment | en |
| 06 | `06-SCREENS-UX.md` | Design tokens, navigation, screen inventory, wireframes, copy glossary fa/en/nl | en |
| 07 | `07-USER-STORIES.md` | Stories with testable acceptance criteria, per milestone | en |
| 08 | `08-TRUST-SAFETY.md` | Community rules, verification, safety controls, admin workflows, privacy | en |
| 09 | `09-BUILD-PLAN.md` | Milestones M0–M6, per-milestone checklist, definition of done | en |
| — | `OPEN-QUESTIONS.md` | Undecided points with defaults; agent appends here | en |
| — | `PROMPTS.md` | **The exact prompts to paste into Antigravity, in order** | en |

## How to use
1. Keep this folder at `hamrah/spec/` and commit it.
2. Do the manual setup in `PROMPTS.md` P0.
3. Paste P1 (read & confirm), answer the agent's questions.
4. For each milestone: P2 → review the plan → let it build → P3 review in a fresh conversation → fix → merge.

## Scope at a glance
- **Built (v1):** OTP login (email/SMS), onboarding, goals, match-scored discover, search, requests, realtime chat, single-user focus room with Jitsi, reviews, report/block, KYC, free + paid mentorship (Stripe, Zarinpal), web/native push, admin console, data export/delete, Capacitor shell, Playwright + CI.
- **Next:** scheduling & reminders (M1) → shared realtime room & goal progress (M2) → skill exchange & matching v2 (M3) → group rooms & events (M4) → in-person safety & fa/en/nl (M5) → mentor payouts, monitoring, launch (M6).
