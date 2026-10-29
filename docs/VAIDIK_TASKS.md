# Vaidik — Consolidated Task Register

**Purpose:** This is the single source of truth for work assigned to Vaidik. Do not create a new task document for each assignment. Mahin updates this file to add/reprioritize work; Vaidik updates status, evidence, and blockers in place.

**Last reviewed:** 2026-10-28  
**Rule:** A task is not complete just because code was pushed. Link the PR/commit and report checks/evidence.

## Status legend
- READY — can start
- IN PROGRESS — actively being worked on
- BLOCKED — waiting on a named dependency
- REVIEW — work submitted; awaiting review/evidence
- DONE — acceptance criteria met and evidence linked
- CANCELLED — explicitly cancelled by Mahin

## Active assignments

| ID | Priority | Task | Status | Owner | Evidence / acceptance criteria | Conflict boundary |
|---|---|---|---|---|---|---|
| V-01 | P0 | Reconcile duplicate DW-011 QA evidence PRs #111 and #114. Compare their changes and current main evidence; recommend one canonical update and identify whether either PR should be closed as duplicate. | READY | Vaidik | Written comparison in this file's Daily Handoff section; exact CI run links and evidence timestamps; no unsupported pass claims. Do not merge/close without Mahin approval. | Documentation/evidence only. Do not edit docs/UI_CLEANUP_MASTER_PLAN.md or PR #118 implementation files. |
| V-02 | P0 | Reconcile DW-003/PWA audit work across #90 and #112. Identify overlapping changes, current cache/offline behavior, stale assertions, and the safest single path forward. | READY | Vaidik | Compare changed files and CI on both PRs; report overlap, unique fixes, test evidence and recommended sequence. Do not merge/close without approval. | Audit and report first. Do not edit sw.js, PWA smoke tests, or shared CSS while Mahin's PR #118 work is active. |
| V-03 | P1 | Review responsive UI/accessibility work in PR #88 against the existing UI audit checklist. | READY | Vaidik | Mobile and desktop evidence; keyboard/focus, contrast, reduced-motion, touch-target, overflow and route checks; list reproducible defects with route/viewport. | Review only; no changes to shared HTML/CSS/JS unless Mahin explicitly assigns a file set. |
| V-04 | P1 | Review the current clean-glass foundation PR #118 without overlapping implementation. | READY | Vaidik | Independent review of customer/seller/owner route behavior; report issues in the PR or this file with exact route, viewport, steps, severity and screenshot/log link. Confirm whether CI evidence reflects the latest head. | Read-only review. Do not edit files changed in #118 or push commits to its branch. |
| V-05 | P1 | Produce a concise release-readiness handoff after V-01 to V-04. | BLOCKED | Vaidik | List open blockers, CI status, merged/unmerged PRs, tested routes, security/payment/PWA caveats, and recommendation: hold or ready for further approval. | Documentation only; no release, merge, deploy, migration or production changes. |

## Standing constraints
1. No merging, closing PRs, deploying, running production migrations, changing production configuration, or accessing customer data without Mahin's explicit approval.
2. Never report a test as passing unless a current run on the exact commit proves it.
3. Keep business logic, authentication, Supabase/RLS, order and payment safety controls unchanged during UI-only work.
4. Do not create a new task file for routine assignments. Update this register.
5. If blocked, set status to BLOCKED, name the dependency, and propose the smallest next action.
6. Before touching code, check the ownership matrix in docs/DOODHWALA_MASTER_PLAN.md. If a task needs a file owned by another person, request a handoff instead of editing it.
7. Keep each PR focused and use a separate branch. Do not push directly to main.

## Daily handoff (append/update this section; do not create another file)

### 2026-10-28 — Initial consolidated assignment
- V-01 through V-04 are assigned; no new implementation work is assigned until file ownership and overlapping PRs are clarified.
- Known open PRs at assignment time: #88, #90, #111, #112, #114, #118.
- Known merged PRs relevant to the current work: #99, #106, #113, #116, #117.
- First action: inspect current PR heads and checks; do not assume older CI evidence applies to a newer commit.
- Vaidik update: pending
- Evidence links: pending
- Blockers/decisions needed from Mahin: pending

## Task update template
When updating a task, change its row above and add a short note below:
- Date / Task ID:
- Status change:
- Work completed:
- Evidence (PR, commit, CI run, screenshot/log):
- Remaining / blocker:
- Next action:


## Migrated standing product QA assignments

These tasks were previously tracked in the removed root TASK_BOARD.md. They are now managed here so all Vaidik work has one home. Live evidence/status must be updated here and in DAILY_PROGRESS.md.

| ID | Priority | Task | Status at migration | Owner | Acceptance / notes |
|---|---|---|---|---|---|
| DW-002 | P0 | Responsive UI and interaction audit: navigation, buttons, forms, loading/empty/error states, mobile and desktop. | TODO / not yet verified | Vaidik | Record route, viewport/device, repro steps, expected vs actual, severity and evidence. Review PR #88 and coordinate with the PR #118 file ownership boundary. |
| DW-011 | P0 | Full product regression, E2E, security and release validation. Prepare and maintain the test matrix; execute tests as features become testable. | TODO / ongoing matrix evidence needs verification | Vaidik | Record exact commit/environment/steps/expected/actual/status/evidence. Include role isolation, idempotency/concurrency, responsive/accessibility, PWA, Android/iOS where available and non-production performance. No production order writes, real payments, production migrations or customer data. |
| DW-003 | P0 | Service worker/offline/reconnect validation. | Open; compare existing PRs #90/#112 before taking code action | Vaidik audit first | Fresh install, cache update, offline navigation, reconnect, physical device follow-up. Report only evidence from exact current commits. |
| DW-004 | P1 | Map existing daily-delivery functionality and identify the smallest valuable improvement without duplicating scheduler logic. | Audit notes migrated; follow-up only if assigned | Vaidik when assigned | Existing customer recurring plans and seller order/route/subscription views are documented in the master plan appendix. Staging behavior remains unverified without approved isolated staging. |

Do not create a separate file for these tasks. Keep task state and evidence in this table or the existing active-task rows above.
