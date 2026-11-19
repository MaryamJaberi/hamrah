# PROMPTS.md — paste these into Antigravity, in order

Open the `hamrah` folder in Antigravity (the `spec/` folder must be inside it). Use one agent conversation per milestone. Paste the prompt text inside the boxes.

---

## P0 — Setup (once, you do this by hand)
1. In Supabase create two projects: `hamrah-dev` and `hamrah-e2e`. Run migrations `001…003` in both (SQL editor, in order).
2. `copy .env.local.example .env.local` and fill the Supabase URL/keys of `hamrah-dev`. Keep `SMS_DEV_LOG=true`.
3. Supabase → Authentication → Email Templates → Magic Link: `کد ورود شما: {{ .Token }}`.
4. `npm install`, `npm run dev`, log in once, then `SEED_ADMIN_EMAIL=you@example.com npm run seed` (in PowerShell: `$env:SEED_ADMIN_EMAIL="you@example.com"; npm run seed`).

## P1 — Read & confirm (no code)
```
Read spec/README.md and spec/AGENTS.md, then every file in spec/ in the order AGENTS.md gives, then skim the codebase (app/, lib/, supabase/migrations/).
Do not write or change any code yet.
Reply with:
(a) the product in 10 bullets,
(b) any contradiction between spec files, or between the spec and the code,
(c) anything in 02-CURRENT-STATE.md that is wrong about the code,
(d) your questions for me.
Then wait for my answers.
```

## P2 — Milestone prompt (repeat for M0, M1, … M6)
```
Implement Milestone M1 from spec/09-BUILD-PLAN.md, covering every story and acceptance criterion for M1 in spec/07-USER-STORIES.md.
Follow spec/AGENTS.md strictly. Work on branch m1-scheduling.
First show me a short plan: files to add/change, the migration outline, and the tests you will write. Wait for my OK.
After my OK, implement, run typecheck, build, the e2e suite and the SQL tests, fix failures, and finish with the report format from AGENTS.md.
```
Replace `M1` / branch name for each milestone: `m0-baseline`, `m1-scheduling`, `m2-shared-room`, `m3-exchange-matching`, `m4-together`, `m5-safety-i18n`, `m6-money-launch`.

## P2-MO — Outings module «بریم بیرون» (already built as MO-1 on branch `mo-outings`)
Use this to review or continue it in Antigravity:
```
Read spec/AGENTS.md, spec/10-OUTINGS.fa.md and spec/11-OUTINGS-SPEC.md, then the code listed in 11 §7.
Check out branch mo-outings. Do not change migration 010 if it is merged; add 011_* instead.
(1) Run supabase/tests/010_outings_test.sql against the e2e project and the e2e suite including e2e/outings.spec.ts.
(2) Report any privacy invariant P1–P10 you can break as user B against user A.
(3) Then implement MO-2 items from 11 §8 one at a time, starting with post-outing feedback. Show a plan first and wait for my OK.
```

## P3 — Independent review (new conversation, after each milestone)
```
You are a reviewer, not the author. Read spec/AGENTS.md, spec/02-CURRENT-STATE.md, spec/04-DATA-MODEL.md, spec/08-TRUST-SAFETY.md and the diff of branch mX-… against main.
Check: (1) every acceptance criterion of Mx has a real test; (2) RLS/RPC security — try to find a way for user B to read or change user A's data; (3) the invariants in 02-CURRENT-STATE.md still hold; (4) RTL/accessibility of new screens; (5) anything that contradicts the spec.
List findings by severity with file:line. Do not fix anything.
```
Then paste the findings into the milestone conversation: `Fix these findings: …`.

## P4 — Small fixes
```
Bug: <what you did> → <what happened> → <what you expected>. Screenshot attached.
Find the cause, fix it with a test that fails before the fix, and tell me the cause in two sentences.
```

## P5 — Before launch (after M6)
```
Prepare production: follow spec/05-ARCHITECTURE.md §Deployment. Create vercel.json crons, a checklist of every env var for Vercel and Supabase prod, a script that runs all migrations against prod, and a Capacitor Android build pointing at CAP_SERVER_URL. Run the RLS audit script from 09-BUILD-PLAN.md "Definition of done" against the e2e project and show results. Do not deploy; give me the steps.
```

## Tips
- If the agent drifts, say: `Stop. Re-read spec/AGENTS.md rule N and redo the last step.`
- Keep `spec/` updated: when you decide an open question, edit `OPEN-QUESTIONS.md` yourself and tell the agent `Q6 decided: …`.
- Commit `spec/` to the repo so every new conversation can read it.
