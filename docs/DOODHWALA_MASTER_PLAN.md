# Doodhwala — Shared Master Plan & Team Rules

**Purpose:** One shared plan for Mahin + ChatGPT + Vaidik. This file holds priorities, ownership boundaries, dependencies and acceptance gates. Use the existing task register and daily log rather than creating a new planning file for each task.

**Last updated:** 2026-10-28  
**Product direction:** Simple for customers and independent milk sellers; premium green/white interface; soft glass accents; balanced density; purposeful cinematic motion. Preserve business logic and security.

## 1. The three-file system

1. **docs/VAIDIK_TASKS.md** — all tasks assigned to Vaidik, with status and evidence.
2. **docs/DOODHWALA_MASTER_PLAN.md** — this file; overall roadmap, ownership and rules.
3. **docs/DAILY_PROGRESS.md** — append a short dated progress entry each work session/day.

Do not create a new file for each daily task, review, or handoff. Update these three files in place.

## 2. Conflict-prevention rules (mandatory)

- One task has one directly responsible owner. The other person can review, but must not edit the same files concurrently.
- Every code task starts with a named branch and a small file-ownership list. Keep PRs focused.
- Before editing, check open PRs and the ownership matrix below. If another PR already changes a file, do not touch it without an explicit handoff.
- If the work crosses ownership boundaries, stop and coordinate first. Do not resolve conflicts by overwriting another person's branch.
- Do not push directly to main. No merging, deployment, production migration, production configuration change, or customer-data access without Mahin's explicit approval.
- No claim of completion without evidence from the exact commit: CI run, tests, screenshots, or reproducible manual steps.
- When task status changes, update the relevant row in the existing task register and add a note to the daily progress log. Do not duplicate the full plan in comments or new files.
- If a blocker appears, record it immediately with owner, dependency, and next action.

## 3. File ownership matrix — current work

| Workstream / files | Primary owner | Other person's role | Current boundary |
|---|---|---|---|
| Clean UI foundation PR #118; shared styles and route HTML touched by that PR | Mahin + ChatGPT | Vaidik reviews only | Vaidik must not commit to PR #118 branch or edit its changed files while it is active. |
| Existing UI audit baseline: docs/UI_CLEANUP_MASTER_PLAN.md | Mahin + ChatGPT | Vaidik reads and reports findings | Keep this audit baseline stable during PR #118; record assignments in the collaboration files. |
| PR #88 responsive UI/accessibility | Vaidik for audit/review first | Mahin reviews findings | Do not overlap with #118 code. If a fix touches #118-owned files, report it and wait for handoff. |
| PRs #90 and #112, PWA/offline audit | Vaidik for comparison and evidence first | Mahin owns current implementation changes | Vaidik reports overlaps and CI; no edits to sw.js or PWA browser test files while #118 is active. |
| PRs #111 and #114, DW-011 QA evidence | Vaidik for comparison and recommendation | Mahin approves resolution | Documentation comparison only until approval; don't merge or close either PR. |
| Seller subscription/billing business logic, payment, auth, Supabase/RLS, order state | Mahin + ChatGPT only unless explicitly reassigned | Vaidik read-only audit when assigned | Never alter payment truth, access control, or production data as part of visual work. |
| Collaboration files (these three files) | Shared: Mahin decides priorities; Vaidik updates own task statuses; ChatGPT maintains plan/progress when requested | Both may edit only separate sections; coordinate if editing same section | Vaidik owns task status/evidence in VAIDIK_TASKS.md; Mahin owns priority/assignment decisions; append daily notes instead of rewriting prior history. |

**When a conflict is unavoidable:** create a handoff note in DAILY_PROGRESS.md with file path, current branch/PR, proposed owner and the exact point where work should resume. Do not create a fourth tracking file.

## 4. Master roadmap and gates

### Phase 0 — Team coordination and CI clarity (P0)
- [ ] Vaidik compares duplicate DW-011 evidence PRs #111/#114 and recommends a single path.
- [ ] Vaidik compares DW-003/PWA PRs #90/#112 and reports overlapping and unique changes.
- [ ] Confirm CI evidence is tied to the latest head commit for each PR.
- [ ] Keep all unapproved merges/releases blocked.

**Exit gate:** one clear recommendation per overlapping PR set, with evidence and no unreviewed merge.

### Phase 1 — Clean UI foundation (P0/P1)
- [ ] Complete verification for PR #118: static checks, SQL/notification contracts, PWA browser smoke, route aliases, offline assets and cache revision.
- [ ] Inspect customer, seller and owner routes at mobile and desktop sizes.
- [ ] Check keyboard navigation/focus, readable contrast, reduced motion, tap targets, horizontal overflow and useful error/empty/loading states.
- [ ] Preserve authentication, checkout, order, seller permissions, Supabase/RLS, payment behavior and PWA fallback.
- [ ] Merge only after all required checks are green and Mahin approves.

**Exit gate:** exact-head CI green; route evidence exists; no known critical regression; approval recorded.

### Phase 2 — Route-by-route whole-app redesign (P1)
- [ ] Customer discovery, search, store/product, cart and checkout.
- [ ] Customer orders, recurring milk-delivery plans, notifications, support and legal.
- [ ] Seller daily workflow: orders, availability, products, delivery schedule, earnings/records and simple navigation.
- [ ] Owner/admin workflow: analytics, seller controls, plans, system health and clear access boundaries.
- [ ] Route aliases, navigation and URLs remain reliable; no 404s.
- [ ] Keep motion purposeful and non-blocking; respect reduced-motion preferences.

**Exit gate:** each route has an owner, test evidence and a clear acceptance status in the daily log/task register.

### Phase 3 — Seller subscription & billing readiness (P1; separate from customer milk plans)
- [ ] Verify seller-to-Doodhwala monthly subscription plans, prices, invoices, payment records, activation, renewal, expiry and owner controls.
- [ ] Verify exact ₹2,000/month and ₹3,500/month prices before showing them as configured; do not assume they exist because they were discussed.
- [ ] Keep customer-to-seller milk payments separate from seller-to-Doodhwala subscription/advertising fees.
- [ ] Never claim a payment settled without authoritative evidence.
- [ ] Verify security/RLS, audit records, error paths and staging end-to-end tests.

**Exit gate:** code/configuration and tests prove the behavior; business model documentation alone is insufficient.

### Phase 4 — Release readiness (P0)
- [ ] Current CI green on intended release commit.
- [ ] Customer, seller and owner critical paths verified.
- [ ] Security, payment, privacy/legal, accessibility, offline and recovery blockers reviewed.
- [ ] PR overlap resolved; release notes and rollback plan prepared.
- [ ] Mahin explicitly approves merge/deploy.

**Exit gate:** written go/no-go decision backed by evidence. Default is HOLD if evidence is missing.

## 5. Definition of done for every task

A task can be marked DONE only when:
1. The stated behavior is implemented or the requested audit is delivered.
2. Relevant tests pass on the exact commit; failed or skipped checks are disclosed.
3. A reviewer can reproduce the result using links, screenshots, logs, or precise steps.
4. No unauthorized changes were made to another person's files.
5. The task row in VAIDIK_TASKS.md and the dated note in DAILY_PROGRESS.md are updated.
6. Any follow-up work is added to the existing task register, not a new file.

## 6. Daily working rhythm

1. **Start:** read this file, VAIDIK_TASKS.md, DAILY_PROGRESS.md and open PR checks.
2. **Claim:** set one task to IN PROGRESS and state branch/PR + owned files.
3. **Work:** do not touch another person's owned files; report blockers early.
4. **Verify:** run relevant checks and save evidence.
5. **Handoff:** update the task row and append a concise daily entry.
6. **End:** list next actions and decisions needed from Mahin.

## 7. Current reference links

- Clean UI foundation PR #118: https://github.com/Mahin98250/Doodhwala/pull/118
- Responsive UI audit PR #88: https://github.com/Mahin98250/Doodhwala/pull/88
- PWA audit PR #90: https://github.com/Mahin98250/Doodhwala/pull/90
- PWA audit PR #112: https://github.com/Mahin98250/Doodhwala/pull/112
- DW-011 evidence PR #111: https://github.com/Mahin98250/Doodhwala/pull/111
- DW-011 evidence PR #114: https://github.com/Mahin98250/Doodhwala/pull/114
- Existing UI audit checklist: docs/UI_CLEANUP_MASTER_PLAN.md
