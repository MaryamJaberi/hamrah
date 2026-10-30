# AGENTS.md — rules for the coding agent (Antigravity / Gemini)

You are working on **Hamrah (همراه)**, an existing Next.js 14 + Supabase app. Read every file in `/spec` before writing code. Order: `README.md` → this file → `00-CONCEPT.fa.md` → `01` … `09` → `OPEN-QUESTIONS.md`.

## Hard rules
1. **Brownfield.** v1 works. Extend it. Do not rename routes, tables, or components unless a spec file says so. Do not delete tests.
2. **One milestone at a time** (`09-BUILD-PLAN.md`). Do not start the next milestone until the owner says so.
3. **Migrations are append-only.** Never edit `001…003` or a migration that was already merged. New file `supabase/migrations/00N_*.sql`.
4. **RLS on every table**, policies in the same migration. Atomic or cross-user actions go through `security definer` RPCs with `set search_path = public`, `revoke … from public, anon`, `grant execute … to authenticated`.
5. **Never trust the client** for prices, status transitions, participants, trust columns, or time of timer actions.
6. **Service role key** only in files that `import 'server-only'`.
7. **Keep the security invariants** listed in `02-CURRENT-STATE.md` true. If a change would break one, stop and ask.
8. **Persian-first UI**, RTL, informal tone, Vazirmatn. Reuse classes from `app/globals.css` and tokens from `tailwind.config.ts`.
9. **Accessibility**: labels on every control; axe check in E2E for new pages.
10. **Tests are part of the work.** Every acceptance criterion in `07-USER-STORIES.md` → a Playwright or SQL test. Include negative tests (another user is denied).
11. **Open questions**: don't decide silently. Use the default in `OPEN-QUESTIONS.md`, add `// DECISION: Qn` in code, and append new questions there.
12. **No new heavy dependencies** beyond the table in `05-ARCHITECTURE.md` without asking.
13. **No secrets** in code, logs, or commits. `.env.local` stays git-ignored.
14. Small commits with clear messages: `m1: add propose_session rpc`.

## How to report after each milestone
```
## Milestone Mx — report
- Stories done: S…
- Migration: 00N_… (tables/columns/RPCs)
- Tests: list files; result of typecheck / build / e2e / sql tests
- Screenshots: 375 px for each new screen (fa), plus en if i18n exists
- Deviations from spec and why
- New open questions
- Demo script (5 steps)
```

## When unsure
Prefer: safer for users > simpler code > more features. Ask the owner a single concrete question rather than guessing on anything touching money, safety, or personal data.
