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


# Consolidated repository planning and audit records

The following material was migrated from the former planning/task documents so their contents remain available in this single master plan. The live task owner/status source is now docs/VAIDIK_TASKS.md; dated work and evidence are recorded in docs/DAILY_PROGRESS.md. The appended audit snapshots preserve historical findings and must not be mistaken for fresh verification.

## A. Legacy task board snapshot (migrated 2026-10-28)

# Doodhwala Team Task Board

> Shared source of truth for Mahin, teammates, and coding agents. Keep this file current in the same PR as task-related changes.
> Last updated: 2026-10-28
> Rule: a checkbox is only checked after the change is merged (or explicitly accepted) and the stated verification is recorded. A coding agent must not mark work done merely because it generated code.

## How to use this board

1. Use the linked GitHub Issue as the live task record; assign a person there and set the status/branch in the issue discussion. The Markdown board is the overview.
2. The owner claims it by changing status to `IN PROGRESS`, adding their branch name, and commenting on the linked GitHub Issue/PR when available.
3. Work in a separate branch and open a small PR. Do not push directly to `main` for feature work.
4. In the PR, list changed files, what changed, checks actually run, manual steps still needed, risks, and screenshots for UI changes.
5. Reviewer checks the diff and tests, then merges. Only then update the task checkbox/status and add the PR/commit evidence.
6. If blocked, set status to `BLOCKED` and write exactly what is needed. Do not silently take another person's in-progress task.

**Status labels:** `TODO` · `IN PROGRESS` · `BLOCKED` · `IN REVIEW` · `DONE`. GitHub Issue open/closed state alone is not enough: keep the issue checklist and comments current.

## Current work queue

### P0 — Reliability and release safety

- [ ] **DW-001 — End-to-end order journey audit** ([Issue #73](https://github.com/Mahin98250/Doodhwala/issues/73))  
  **Owner:** Mahin Patel (@Mahin98250) · **Status:** IN PROGRESS (offline preflight; full staging blocked) · **Area:** QA / Customer + Provider  
  **Goal:** Verify customer checkout → provider queue → provider status updates → customer tracking in an isolated staging project.  
  **Done when:** Evidence records the same staging order ID across both roles; status survives reload/reconnect; no duplicate order on retry; mobile flow is checked. Never create synthetic test orders in production. Offline multi-provider partial-failure/retry regression coverage is implemented in [PR #80](https://github.com/Mahin98250/Doodhwala/pull/80); this does not replace staging acceptance.  
  **Depends on:** Authorized staging project and test accounts. Full staging remains blocked because no isolated test project is provisioned; do not incur unapproved charges or write test orders to production.  
  **Branch:** `qa/dw-001-order-retry-recovery`  
  **Evidence:** [PR #80](https://github.com/Mahin98250/Doodhwala/pull/80) · [Static validation passed](https://github.com/Mahin98250/Doodhwala/actions/runs/40309741459) · [SQL migration validation passed](https://github.com/Mahin98250/Doodhwala/actions/runs/40309741596).

- [ ] **DW-002 — Responsive UI and interaction audit** ([Issue #74](https://github.com/Mahin98250/Doodhwala/issues/74))  
  **Owner:** Vaidik Patel (@vaidikpatel22112010-tech) · **Status:** TODO (awaiting task acknowledgement) · **Area:** Customer UI / QA  
  **Goal:** Check navigation, buttons, forms, loading/empty/error states, and mobile/desktop layouts.  
  **Done when:** Findings are recorded with route, device/viewport, steps to reproduce, expected vs actual result, and severity; critical issues are fixed or converted into tasks.  
  **Master UI plan:** [docs/UI_CLEANUP_MASTER_PLAN.md](docs/UI_CLEANUP_MASTER_PLAN.md) — repository route/style/script map and prioritized checklist; rendered-device QA, accessibility execution and staging E2E remain unverified.  
  **Evidence:** PR/Issue: add link · Checks: not run.

- [ ] **DW-003 — Service worker and offline/reconnect validation** ([Issue #75](https://github.com/Mahin98250/Doodhwala/issues/75))  
  **Owner:** Unassigned · **Status:** TODO · **Area:** PWA / QA  
  **Goal:** Confirm the latest assets replace stale cached assets and the UI explains offline status accurately.  
  **Done when:** Fresh install, update from previous cache, offline navigation, and reconnect are tested on a real or clearly identified browser/device. Do not imply offline orders are queued unless implemented.  
  **Evidence:** PR/Issue: add link · Checks: not run.

### P0 — Complete remaining product features and release validation

- [ ] **DW-010 — Complete remaining Doodhwala product features** ([Issue #93](https://github.com/Mahin98250/Doodhwala/issues/93))  
  **Owner:** Mahin Patel (@Mahin98250) · **Status:** IN PROGRESS (feature inventory published; focused implementation work started) · **Area:** Product / Customer + Provider + Admin + Backend  
  **Goal:** Close the remaining user journeys and security/release gaps, including identity, discovery, cart/checkout, orders, subscriptions, provider operations and billing, admin, delivery/GPS, notifications, support, account deletion/privacy, PWA resilience and store packaging.  
  **Done when:** Every scope item has a focused PR, observed verification evidence, and project-lead review. Do not treat schema/UI existence as proof that a feature works. Keep promo checkout disabled unless atomic server-side redemption is implemented.  
  **Current implementation evidence:** Provider monthly billing invoice idempotency is being added to [PR #71](https://github.com/Mahin98250/Doodhwala/pull/71); the new migration and its CI job have not yet been observed passing.  
  **Safety:** No production migration, merge, deployment, real-payment collection, or production test orders without explicit approval.

- [ ] **DW-011 — Full product regression, E2E, security and release validation** ([Issue #94](https://github.com/Mahin98250/Doodhwala/issues/94))  
  **Owner:** Vaidik Patel (@vaidikpatel22112010-tech) · **Status:** TODO (assigned; prepare the test matrix now and execute as features become testable) · **Area:** QA / E2E / Accessibility / Security / Release  
  **Goal:** Independently validate the complete feature scope in #93 after each area is ready, with final cross-feature regression at the end.  
  **Done when:** The matrix records commit, environment, exact command/steps, expected vs actual result, PASS/FAIL/BLOCKED/NOT RUN, and evidence for every scenario. Include role-isolation, concurrency/idempotency, responsive/accessibility, PWA update/offline, Android/iOS where available, and non-production performance tests.  
  **Safety:** No production order writes, real money, paid services, production migrations, or customer data. Never mark unrun/device-blocked tests as passed.

### P1 — Customer and seller daily workflow

- [ ] **DW-004 — Map existing daily-delivery functionality** ([Issue #76](https://github.com/Mahin98250/Doodhwala/issues/76))  
  **Owner:** Unassigned · **Status:** TODO · **Area:** Product / Customer + Provider  
  **Goal:** Inspect existing order/subscription code before proposing a new daily-delivery feature.  
  **Done when:** A short note identifies what already works, what is demo-only, missing scheduling rules, and the smallest valuable next improvement. No duplicate system is built.  
  **Evidence:** PR/Issue: add link · Checks: code inspection.

- [ ] **DW-005 — Loading, empty, error, and success states** ([Issue #77](https://github.com/Mahin98250/Doodhwala/issues/77))  
  **Owner:** Unassigned · **Status:** TODO · **Area:** UX  
  **Goal:** Make asynchronous actions understandable while preserving existing behavior and accessibility.  
  **Done when:** Selected high-priority screens have consistent, tested states and no false success messages.  
  **Evidence:** PR/Issue: add link · Checks: not run.

### P2 — Payments and security (do not enable live collection)

- [ ] **DW-006 — Payment foundation deployment readiness review** ([Issue #78](https://github.com/Mahin98250/Doodhwala/issues/78))  
  **Owner:** Unassigned · **Status:** TODO · **Area:** Backend / Security  
  **Goal:** Compare migrations, Edge Function, authorization, webhook design, and current staging/production state.  
  **Done when:** A reviewer-approved checklist separates implemented, tested, deployed, and unverified items. Real payment collection remains disabled until a genuine provider/acquirer integration is fully reviewed.  
  **Evidence:** PR/Issue: add link · Checks: not run.

- [ ] **DW-007 — RLS and role-authorization review** ([Issue #79](https://github.com/Mahin98250/Doodhwala/issues/79))  
  **Owner:** Unassigned · **Status:** TODO · **Area:** Backend / Security  
  **Goal:** Check customer, provider, and admin access against actual database policies and server functions.  
  **Done when:** Findings have reproducible tests and fixes or explicit follow-up tasks. No secrets or personal customer data in logs.  
  **Evidence:** PR/Issue: add link · Checks: not run.

## Add a task

Copy this template and give each task a unique ID:

- [ ] **DW-XXX — Short action title**  
  **Owner:** Unassigned · **Status:** TODO · **Area:** Customer UI / Provider UI / Backend / Security / QA / Docs  
  **Goal:** One clear outcome.  
  **Scope:** Files/routes or subsystem to inspect; what is out of scope.  
  **Done when:** Observable acceptance criteria and tests.  
  **Dependencies:** None / list dependencies.  
  **Branch:** Not started.  
  **Evidence:** PR/Issue: add link · Checks: not run.

## Work log

Add newest entries first. Link to the PR/commit and report checks honestly.
| Date | Task | Person / agent | Summary | Verification / evidence |
|---|---|---|---|---|
| 2026-10-27 | DW-010 feature completion program | Mahin + coding agents | Created a full feature-completion epic covering identity, discovery, checkout/orders, subscriptions, seller/admin operations, provider billing, delivery/GPS, notifications, support/privacy, PWA, mobile-store readiness and safety gates. | [Issue #93](https://github.com/Mahin98250/Doodhwala/issues/93). This is an inventory/implementation gate, not a claim that all items are complete. |
| 2026-10-27 | DW-011 final test ownership | Vaidik Patel (@vaidikpatel22112010-tech) | Assigned the full-product regression/E2E/security/accessibility/device/load validation task; prepare the test matrix now, run final end-to-end coverage as feature areas become ready, and record evidence honestly. | [Issue #94](https://github.com/Mahin98250/Doodhwala/issues/94). Physical-device tests and authenticated staging journeys remain unverified until actual evidence is recorded. |
| 2026-10-27 | Provider billing idempotency hardening | Mahin + coding agents | Added a calendar-month boundary/one-provider-month invoice constraint, retry-safe invoice RPC behavior, static contract checks, disposable PostgreSQL fixture/assertions, and a CI job on the existing billing PR branch. | [PR #71](https://github.com/Mahin98250/Doodhwala/pull/71), branch `feat/provider-monthly-billing`, latest commit `9dd71574810966c1023caa48fe65de6f6f130eca`. A dedicated disposable-PostgreSQL workflow is now running for this exact commit; do not mark it passed until the run finishes. |
| 2026-10-27 | Account-deletion request and owner triage | Mahin + coding agents | Added public request/status/cancel UI, private request storage, owner-only review queue, guarded status transitions, explicit RPC grants, and disposable PostgreSQL assertions. | [Draft PR #96](https://github.com/Mahin98250/Doodhwala/pull/96). Static validation passed at commit `6f8a3adf810f68f16def707743aadde31870a8cc`; later explicit-grant assertions exposed a malformed test delimiter and are being revalidated. Final deletion/anonymisation and retention policy remain blockers. |
| 2026-10-27 | In-app order notifications | Mahin + coding agents | Added order-event notification creation for customers and new-order alerts for providers, private notification storage, scoped list/read/mark-all RPCs, responsive center, and route/style/script precache. | [Draft PR #97](https://github.com/Mahin98250/Doodhwala/pull/97). Static, general SQL, and dedicated disposable-PostgreSQL checks passed on commit `e089bd93d281bba22726f9c159ad7ebdd9fa9fb4`. Push delivery is not configured; authenticated staging/device checks remain pending. |
| 2026-10-26 | DW-001 checkout recovery preflight | Mahin Patel + coding agents | Fixed the partial multi-provider checkout confirmation trail: completed order IDs/payment choice persist across retries, including retry after reload, and the readiness error avoids falsely saying no order exists when a prior seller order succeeded. | [PR #80](https://github.com/Mahin98250/Doodhwala/pull/80); [Static validation passed](https://github.com/Mahin98250/Doodhwala/actions/runs/40309741459); [SQL migration validation passed](https://github.com/Mahin98250/Doodhwala/actions/runs/40309741596). Live staging/Auth/RLS/Realtime/device journey remains unverified. |
| 2026-10-26 | Collaboration system expanded | Mahin + coding agents | Added issue/bug templates, a PR checklist, contribution instructions, and seven live starter task issues. | [DW-001 #73](https://github.com/Mahin98250/Doodhwala/issues/73), [DW-002 #74](https://github.com/Mahin98250/Doodhwala/issues/74), [DW-003 #75](https://github.com/Mahin98250/Doodhwala/issues/75), [DW-004 #76](https://github.com/Mahin98250/Doodhwala/issues/76), [DW-005 #77](https://github.com/Mahin98250/Doodhwala/issues/77), [DW-006 #78](https://github.com/Mahin98250/Doodhwala/issues/78), [DW-007 #79](https://github.com/Mahin98250/Doodhwala/issues/79). Collaboration PR remains open; no application code changed. |
| 2026-10-26 | DW-002 assigned | Mahin Patel → Vaidik Patel (@vaidikpatel22112010-tech) | Verified Vaidik has write access and assigned the responsive UI audit. Updated issue #74 with lead/contributor roles and required workflow. | [Issue #74](https://github.com/Mahin98250/Doodhwala/issues/74); assignment confirmed. Audit not yet started/verified. |
| 2026-10-26 | Collaboration setup | Mahin + coding agents | Added a shared task board and agent handoff rules. | Documentation change; implementation tasks remain open. |

## Coordination rules

- One owner per task; helpers are welcome, but the owner coordinates and reports status.
- Avoid two people editing the same file at the same time. If overlap is unavoidable, agree in the task before coding.
- Never put API keys, service-role keys, passwords, OTPs, customer data, or secrets in this file.
- Never merge an agent's changes without inspecting the diff and running relevant checks.
- Do not mark tasks done based on a successful build alone if the task requires real authentication, RLS, Realtime, payments, GPS, or device testing.
- Update `PROJECT_CONTEXT.md` when architecture, product direction, or verification status materially changes.


## B. Coding-agent and contributor operating guide (migrated 2026-10-28)

# Coding Agent Guide — Doodhwala

Read this before making any change. These instructions apply to every coding agent and human contributor.

## Before you start

1. Read `PROJECT_CONTEXT.md`, `TASK_BOARD.md`, and `README.md`.
2. For Supabase work, also read `SUPABASE_SETUP.md` and the relevant security/payment docs.
3. Inspect the current branch, `git status`, recent commits, open PRs, and the actual code paths. The documentation may be stale; source code and merged commits are the evidence.
4. Select one task from `TASK_BOARD.md`. If none fits, propose a task and acceptance criteria before making a broad change.
5. Confirm no one else is already changing the same files. Claim the task by setting its status to `IN PROGRESS`, recording the owner and branch, and updating the task issue/PR when one exists.

## Branch and pull request workflow

- Never commit feature work directly to `main`.
- Use a small branch such as `fix/mobile-checkout`, `feat/delivery-summary`, or `docs/task-board`.
- Keep each PR focused on one task. Avoid unrelated refactors.
- Before requesting review: inspect `git diff`, run `git diff --check`, discover the real test/build commands from repository configuration, and run relevant checks.
- In the PR description include: task ID, purpose, changed files, test commands and actual results, manual test steps, screenshots for UI changes, migration/deployment notes, and known limitations.
- Request review from another teammate. Do not merge your own work unless the project owner explicitly authorizes that workflow.
- After merge, update `TASK_BOARD.md` and, for meaningful architecture or status changes, `PROJECT_CONTEXT.md` with factual evidence.

## Collaboration and conflict prevention

- Do not overwrite, reset, force-push, or discard another person's work.
- Do not edit files another owner has claimed without coordinating first.
- Keep commits small and use descriptive messages.
- If a task becomes larger than expected, stop and split it into smaller tasks rather than making a risky all-at-once change.
- If network access or a coding session stops, preserve changes. On resume, inspect branch/status and remote updates before continuing.

## Product and security guardrails

- Doodhwala serves independent neighbourhood milk providers, not large packaged dairy brands.
- Keep the experience mobile-first and responsive on desktop; aim for polished, clear interactions without sacrificing existing working behavior.
- Never present demo listings as real providers.
- Never claim a feature is production-ready, deployed, tested, compliant, or successful without evidence.
- The current payment foundation is not a live automated payment gateway. Do not enable real-money collection or claim bank-verified success. Direct UPI seller confirmation is seller-attested only.
- Never expose Supabase service-role keys or other secrets in browser code, commits, issues, screenshots, logs, or docs. Do not collect card details, CVV, UPI PINs, OTPs, or banking passwords.
- Treat database/RLS/Edge Function changes as security-sensitive. Use staging and test authorization for customer, provider, and admin roles.
- Do not deploy migrations or change production configuration without explicit approval and a rollback plan.

## Required end-of-task report

Report these items clearly:
1. **Task ID and status**
2. **What changed** (file paths)
3. **Branch and PR link**
4. **Checks run** (commands + pass/fail; say “not run” when applicable)
5. **Manual testing still needed**
6. **Risks, blockers, and next step**
7. **Docs/task board updated:** yes/no

A generated patch is not automatically a completed task. Mark a task DONE only when acceptance criteria are met, the change is reviewed/merged or explicitly accepted, and evidence is recorded.
## Team roles and task delegation

- **Project lead / final decision-maker: Mahin Patel (@Mahin98250).** The project lead sets priorities, assigns tasks, approves scope changes, and makes final product decisions.
- **Assistant contributor: Vaidik Patel (@vaidikpatel22112010-tech).** Work on the task explicitly assigned by the project lead, follow its acceptance criteria, and keep implementation aligned with the project context and coding standards.
- The assistant contributor may recommend improvements, identify risks, and propose follow-up tasks, but must not silently expand scope or override the project lead's decisions.
- Before starting, acknowledge the task, summarize the intended approach, identify dependencies, and create/use a dedicated branch. If a requirement is unclear or conflicts with existing behavior, ask before making a high-impact assumption.
- Send concise progress updates at meaningful checkpoints: investigation complete, implementation complete, checks complete, and blockers. Do not claim work is complete until evidence and test results are reported.
- If blocked, report the exact blocker, what was tried, and the smallest decision or access needed. Do not work around permissions, expose secrets, or change production systems to bypass a blocker.
- The project lead reviews the result through a pull request. Follow review feedback, make requested corrections, and wait for explicit approval before merging or deploying.
- Be respectful and professional. Task ownership defines decision authority for the project; it does not remove the responsibility to raise security, reliability, or data-loss concerns.


## C. PWA/offline audit (migrated 2026-10-28; historical findings, verify against current code)

# DW-003 PWA cache freshness and honest offline behavior

**Scope:** Service-worker cache freshness, exact customer asset URLs, cache cleanup on the shared GitHub Pages origin, network-response persistence, offline fallback and reconnect messaging.

## Findings and fixes

### PWA-001 — exact asset variants must be precached
Checkout requests `/Doodhwala/customer-journey-refresh.css?v=20261025.1`; an older customer UI polish URL is `/Doodhwala/customer-ui-polish.css?v=20261025.3`; customer pages also request the mascot without a query string. The worker now includes those exact URLs alongside newer variants. The current cache name is `doodhwala-v98` (retained rather than downgrading the repository's later cache revision).

### PWA-002 — only Doodhwala cache keys may be removed
Activation now deletes obsolete keys only when they begin with `doodhwala-`. Unrelated Cache Storage entries on the shared `mahin98250.github.io` origin are preserved.

### PWA-003 — network cache writes must finish before the response resolves
The worker now awaits `cache.put(event.request, response.clone())` for successful same-origin GET responses before returning the network response. Cache failures do not block the online response, but the write is no longer fire-and-forget.

### PWA-004 — offline recovery must be part of the core shell
`/Doodhwala/offline.html` is included in `CORE_ASSETS`; failure to cache it therefore prevents the install from being treated as successful. Offline messaging says previously cached pages may remain available and that sign-in, account, order, live-update and payment actions need a connection.

## Automated validation

- `scripts/test-service-worker.mjs` covers obsolete-cache cleanup, unrelated-cache preservation, exact URL precache contracts, required offline core asset, and the awaited query-string cache write.
- `scripts/test-pwa-offline-contracts.mjs` protects cache scope, exact asset variants and customer-facing offline/reconnect copy.
- `.github/workflows/pwa-browser-evidence.yml` runs a local static server with isolated browser storage, captures screenshots and writes JSON results to a downloadable artifact. External requests are blocked; it does not authenticate users, submit orders, or perform payments.

## Manual/device follow-up still required

- Test physical Android and iOS devices and an installed PWA update while an older tab remains open.
- After reconnect, manually refresh and confirm fresh seller/page content appears.
- Browser automation does not establish real authentication, payment or order-submission behavior.
- Vercel preview is not required for this local offline test and remains subject to the existing free-tier deployment rate limit.

## Safety

No production deployment, production configuration changes, migrations, secrets, real payments, or paid services are used by these checks.


## D. Daily delivery functionality audit (migrated 2026-10-28; source-inspection evidence only)

# Daily delivery functionality audit

**Reviewed:** 2026-10-27  
**Scope:** Customer recurring plans and the independent seller's daily order/route workflow.  
**Environment:** Source inspection only; no authenticated staging session, real order, payment, location trace or production data was used.

## What already exists

### Customer recurring plans
- `plans.html` and `plans.js` create a plan through `create_milk_subscription` and support editing, pausing, resuming, skipping one scheduled delivery and cancelling through their existing RPCs.
- The plan form previews selected weekdays and the first week's delivery count. Each saved plan also renders a rolling seven-day view based on the plan's date range, weekdays and any returned delivery records.
- Cutoff/ownership/business rules remain enforced by the backend RPCs; a frontend message is not proof that an operation was accepted.
- The UI is source-verified, but real authenticated plan creation, delivery-generation and cutoff behavior still require an approved staging environment.

### Seller orders and recurring route
- `provider.html` exposes separate Orders, Today's route and Subscriptions views, plus mobile navigation.
- `provider.js` uses `provider_update_order_status` for legal order-state transitions, asks for a reason when declining/cancelling, shows response deadlines, and refreshes the order queue with Realtime plus a fallback refresh.
- The route view uses `get_provider_delivery_route`; its dispatch board uses `get_provider_dispatch_board`. Recurring customer summaries use `provider_get_subscriptions`.
- The seller subscription list is informational; daily order-state changes happen through the associated order workflow. This PR deliberately does not create a second scheduler or introduce new database/RPC contracts.

## Usability gap addressed in this change

1. Decline/cancel reasons previously used the browser's `prompt()`, which interrupts the mobile flow and provides little inline guidance.
2. Order cards showed a status badge but no quick visual indication of completed/current/next stages.
3. Queue filters did not show counts, making it harder for sellers to see how much work needs action.

The branch replaces the decline/cancel prompt with an accessible in-app dialog and inline validation, adds an escaped status-progress indicator, adds filter counts, gives status errors plain-language handling, and makes the updated assets available through the existing service-worker cache.

## Boundaries and verification

- No new order or subscription state is invented in the UI; state changes continue through the existing server RPC.
- Customer-facing reasons and status labels must be escaped before rendering.
- Automated source/runtime contract checks are added to static CI. CI results are recorded in the PR as they complete.
- Authenticated browser flows, physical-device usability, Realtime behavior against a real staging project and the full customer-to-seller journey remain **not verified** until the project has approved isolated staging credentials and test accounts.
- A green syntax/contract workflow does not establish that production integration is ready.


## E. Whole-app UI cleanup audit and detailed route checklist (migrated 2026-10-28)

# Doodhwala Whole-App Clean UI Audit & Master Checklist

**Status:** Planning baseline — audit inventory completed; implementation not started  
**Baseline branch:** `main`  
**Baseline commit:** `46b48d20c896bee9f96902d2fc2fbee0f1fc0158`  
**Chosen direction:** soft glass accents + balanced density + cinematic, purposeful motion  
**Product constraint:** Keep the experience simple for customers and independent milk sellers. Preserve existing business logic, authentication, database/RLS rules, payment safety controls, PWA/offline behaviour and direct navigation.

## 1. Audit scope and confidence

The repository tree was inventoried at the baseline commit (237 tracked files). The inventory includes customer marketplace, auth, checkout, product/store, plans, orders, notifications, support/legal, provider console, admin console, PWA/service worker, shared styles/scripts, Supabase migrations, SQL tests and CI workflows.

This is a **repository and architecture inventory**, not a claim that every route has been visually tested in a live browser. Current evidence does not establish that all pages have been opened on real mobile/desktop devices or that all role-specific end-to-end flows pass. Those checks remain explicit release gates below.

## 2. Initial audit findings

### P0 — consistency and regression risks to investigate first

- [ ] **Layered CSS needs a dependency audit.** The customer home imports multiple styling layers (base styles, experience layer, marketplace refresh, customer polish, milk transition and splash). Map selector ownership, import order, duplicate overrides and specificity before consolidating anything.
- [ ] **Route variants must remain equivalent.** The repository contains root HTML files and directory-style route entry points (for example `auth.html` and `auth/index.html`, plus similar patterns for admin, checkout, plans, orders, product, provider, notifications, support, legal, store and offline). Compare content, asset paths, cache versions and navigation destinations so one entry point does not drift or 404.
- [ ] **Preserve role and data boundaries.** Admin/provider/customer pages must not leak privileged actions or private fields through a UI refactor. UI hiding is not authorization; retain backend RLS, secure RPCs, server-side validation and role checks.
- [ ] **Preserve payment safety.** Current docs state the automated gateway is not ready to move money. UI must never imply payment settlement from a redirect/client event or mark an order paid without authoritative server confirmation.
- [ ] **PWA/offline assets and cache revision.** Every shared UI asset and route shell change must be checked against service-worker precache/runtime rules, cache invalidation and offline fallback tests.
- [ ] **Avoid broad visual rewrites before baseline screenshots and tests.** Record current route coverage, existing functionality and console/network errors before replacing shared tokens or navigation.

### P1 — complete shared design system

- [ ] Define semantic tokens for background/surface/elevated surface, text/muted text, border, primary/hover/focus, success/warning/error/info, overlay and scrim.
- [ ] Establish a restrained glass recipe: readable opaque base, subtle translucent surfaces only where useful, controlled blur, quiet border/highlight, no low-contrast text, and solid fallback where backdrop-filter is unsupported.
- [ ] Define type scale, line-height, font weights, content widths, spacing scale, radii, shadows/elevation and motion durations/easing.
- [ ] Standardize buttons (primary/secondary/tertiary/destructive/icon), inputs, selects, checkboxes, search, cards, chips, tabs, badges, tooltips, dialogs, drawers, toasts, tables, pagination, skeletons and empty/error states.
- [ ] Standardize focus-visible rings, hover/pressed/disabled/loading states and touch targets.
- [ ] Define reusable responsive breakpoints and layout rules; prevent horizontal page overflow.
- [ ] Create icon rules (consistent icon set, stroke weight and size); replace inconsistent Unicode symbols where practical without changing behaviour.
- [ ] Create motion guidelines: cinematic intro is optional and short; navigation and task flows stay fast; no blocking animation; support `prefers-reduced-motion`; skip intro; avoid motion on every card/action.
- [ ] Add documentation/examples for components and visual regression baselines before mass adoption.

### P1 — customer journey

- [ ] Home: hero hierarchy, location prompt, search, categories, provider discovery, filter/sort controls, comparison dock/dialog, responsive card grid and footer.
- [ ] Search/discovery: clear query, no-results state, loading/error states, filter chips, sort controls, distance/availability explanations and accessible controls.
- [ ] Provider/store/product: identity and verification status, milk type, price/unit, availability, delivery coverage/timing, product selection and clear add-to-cart feedback.
- [ ] Cart/drawer: item quantities, provider grouping, subtotal, empty state, unavailable products and clear checkout action.
- [ ] Auth: sign-in/sign-up/OAuth/profile completion, validation messages, pending states, password visibility and recoverable errors.
- [ ] Address/location: permission denied, unavailable GPS, manual location, invalid pin, loading, save/edit and persistence states.
- [ ] Checkout: address review, provider grouping, delivery expectations, payment choice, duplicate-submit prevention, safe errors and success/track-order path.
- [ ] Orders: readable status timeline, empty/loading/error/offline states, refresh/reconnect handling and clear next action.
- [ ] Plans/subscriptions: schedule/quantity preview, pause/resume/cancel states, capacity constraints, next delivery and confirmation dialogs.
- [ ] Saved items, notifications and support: consistent lists, unread states, accessible forms and clear confirmation/error messages.
- [ ] Legal: readable content hierarchy, responsive long-form layout and clear indication where policies remain drafts pending review.

### P1 — seller/provider journey

- [ ] Onboarding: clear step count, validation, progress, back/continue, save/resume and helpful field explanations.
- [ ] Provider dashboard: prioritise today's orders, action-required items, availability and profile readiness; avoid overwhelming KPI clutter.
- [ ] Catalogue: add/edit/delete/activate/pause, stock/availability, price/unit, search/filter and confirmation for destructive actions.
- [ ] Service area and schedule: explain locality, PIN/radius and delivery windows; handle invalid/incomplete location input.
- [ ] Order queue: legible status, customer/order details permitted for the seller, empty/loading/error states and duplicate-action prevention.
- [ ] Lifecycle actions: only offer valid next states; display pending/success/failure feedback and preserve backend-enforced transitions.
- [ ] Seller profile/trust: clear verification status and outstanding actions; never imply approval before backend confirmation.
- [ ] Provider mobile navigation and desktop sidebar: consistent active states, labels, back behaviour and safe-area spacing.

### P1 — owner/admin journey

- [ ] Admin overview: define information hierarchy and ensure charts/totals have loading, empty, stale and error states.
- [ ] Seller moderation: pending/approved/rejected/suspended states, reason capture and confirmation for high-impact actions.
- [ ] Customer, orders and subscriptions: consistent filters, search, pagination, detail panels and empty/error states.
- [ ] Analytics: label metrics and time windows; avoid misleading demo data or unverified live claims.
- [ ] System health/security: distinguish informational warnings from actionable incidents; never expose secrets or private user data.
- [ ] Admin navigation and tables: keyboard-accessible controls, responsive overflow handling and clear destructive-action confirmation.
- [ ] Ensure each admin endpoint/action remains authorized server-side; do not trust client-only route guards.

### P2 — motion, polish and responsive quality

- [ ] Define cinematic motion as a small set of branded moments (startup/transition/confirmation), not continuous decoration.
- [ ] Ensure the startup screen cannot trap navigation, block critical content or repeatedly replay within the same session.
- [ ] Check mobile safe areas, landscape/short-height screens, 320px-width devices, large text and browser zoom.
- [ ] Respect reduced motion and avoid flashing/parallax that can trigger discomfort.
- [ ] Optimize large images, avoid unnecessary blur layers, avoid layout shifts and measure interaction responsiveness on low-end phones.
- [ ] Verify contrast over translucent surfaces in every theme/state; provide non-glass fallback.

### P0 — functionality and accessibility release gate

- [ ] No broken internal links, 404 route variants, console errors or missing assets.
- [ ] Every visible interactive control has a working action, a clear disabled state or is removed.
- [ ] Keyboard-only journey works for menus, dialogs, drawers, forms and checkout; focus is visible and restored appropriately.
- [ ] Forms have associated labels, useful validation, clear error announcements and correct input types.
- [ ] Semantic landmarks/headings, accessible names, alt text and dialog semantics are present.
- [ ] Automated checks cover CSS/JS syntax, links/routes, shared UI contracts and service-worker cache contracts.
- [ ] Test viewport matrix: small Android phone, standard phone, tablet, laptop and wide desktop; include landscape and reduced-motion mode.
- [ ] Test network states: slow/failed network, offline launch, stale cache, reconnection and session expiry.
- [ ] Test real staging end-to-end: customer checkout → provider queue → provider status transitions → customer tracking, using authorized staging accounts and non-production data.
- [ ] Verify auth, RLS, secure RPC permissions, payment status boundaries and admin/provider authorization have not changed.
- [ ] Wait for all required PR CI checks to complete successfully; inspect changed files and check results before merge.
- [ ] After merge, verify GitHub Pages deployment and inspect the live app on a real device. CI success alone is not proof of visual correctness or backend E2E success.

## 3. Prioritised delivery plan

| Priority | Workstream | Output / exit criteria |
|---|---|---|
| P0 | Baseline audit | Route/file inventory, CSS ownership map, functionality map, screenshots, broken-link/console baseline and risk register |
| P0 | Shared tokens and primitives | Documented tokens/components with contrast, focus, reduced-motion and fallback rules |
| P1 | Customer core | Home → discovery → product/store → cart → checkout → order tracking remains functional and visually consistent |
| P1 | Seller core | Onboarding → catalogue → availability → order queue → lifecycle remains functional and easy on mobile |
| P1 | Admin core | Moderation, order/customer/subscription management and health views consistent without weakening authorization |
| P1 | Secondary customer routes | Plans, saved, notifications, support, legal and profile states follow the same system |
| P2 | Motion and performance | Cinematic brand moments are short, skippable, responsive, accessible and measured |
| P0 release gate | Regression and release | Required CI green, staging E2E recorded, route/device review completed, Pages deployment verified |

## 4. Coordinated PR strategy

Use small, reviewable PRs that share the same design contract. Do not allow parallel workers to independently edit the same global CSS or navigation files.

1. **PR A — Audit and design contract:** this checklist, route inventory, CSS ownership map and visual standards. No production UI behaviour changes.
2. **PR B — Tokens and primitives:** shared CSS variables and reusable low-risk primitives, with screenshots/contract tests.
3. **PR C — Customer shell and home:** responsive shell/navigation and discovery UI, preserving all selectors and data contracts required by current JS.
4. **PR D — Customer transactional flow:** product/store/cart/checkout/orders, with regression tests and no payment/auth policy changes.
5. **PR E — Seller experience:** onboarding, dashboard, catalogue, service area and order queue.
6. **PR F — Admin/operations:** dashboard, moderation, tables and health panels.
7. **PR G — Secondary routes and motion:** plans, notifications, support/legal, startup and transitions.
8. **PR H — final quality gate:** cross-route visual/accessibility/device tests, cleanup, performance and deployment validation.

PRs may be split further if a workstream is large. Each PR must state changed routes, preserved behaviour, screenshots or before/after evidence, tests run, known limitations and rollback considerations. Merge only after required CI succeeds and review findings are resolved.

## 5. Working agreements for contributors

- One shared task board is the source of truth. Each task has an ID, priority, owner, files/routes, acceptance criteria, test evidence and status.
- Assign one owner for shared tokens/navigation. Other contributors consume the contract rather than creating competing global styles.
- Separate visual changes from backend/schema/security changes. Any unavoidable backend impact requires explicit review and independent tests.
- Do not change RLS policies, auth checks, payment state transitions, secrets, order calculations or production data as part of a UI-only task.
- Do not claim visual/device/E2E verification without recorded evidence.
- Avoid adding paid APIs, libraries or infrastructure unless explicitly approved. Prefer the existing static HTML/CSS/JS architecture and current tooling.
- Keep the customer and seller UI simple. Advanced admin capabilities should not spill into everyday customer/seller workflows.

## 6. Definition of done for the whole-app UI

- [ ] Every tracked user-facing route is inventoried and assigned a reviewed status.
- [ ] Shared tokens/components are used consistently; old overrides are removed only after usage and regression analysis.
- [ ] Customer, seller and admin primary journeys remain functional.
- [ ] No known broken links, missing assets, horizontal overflow or critical console errors.
- [ ] Responsive layouts and reduced-motion behaviour are checked on representative devices.
- [ ] Accessibility checks cover focus, labels, semantics, contrast and dialogs.
- [ ] PWA/offline cache and direct route entry remain correct.
- [ ] Staging E2E proves the real order journey without synthetic production data.
- [ ] Security/payment boundaries are unchanged and relevant tests pass.
- [ ] All required CI checks are green on the exact PR head; no merge while checks are pending or failing.
- [ ] Live deployment and a real-device visual review are recorded after merge.

**Next action:** complete the detailed route-by-route baseline (including CSS/JS ownership and direct-link parity), then propose the shared design tokens before implementing the redesign.


## 7. Route-by-route asset ownership audit (static source inspection)

All route entry points below were read at baseline `46b48d20c896bee9f96902d2fc2fbee0f1fc0158`. The directory-style public routes and their corresponding root HTML files have matching Git blob SHAs for the checked pairs; they are currently exact-content aliases, not separate implementations. Keep this parity as a CI contract.

| User journey / route | HTML entry points | Page CSS layer(s) after shared base | Main page logic / shared runtime |
|---|---|---|---|
| Customer home/discovery | `index.html` | `styles.css`, `experience-layer.css`, `marketplace-refresh.css`, `customer-ui-polish.css`, `milk-transition.css`, `splash-screen.css` | `app.js`, `location.js`, `customer-nav.js`, `milk-transition.js`, `splash-screen.js`, Supabase client/config, resilience, session controls, PWA registration, network status |
| Sign in / account | `auth.html`, `auth/index.html` | `styles.css`, `auth.css`, `milk-transition.css` | `auth.js`, shared Supabase/resilience/session/PWA/network runtime, transition |
| Checkout | `checkout.html`, `checkout/index.html` | `styles.css`, `experience-layer.css`, `checkout.css`, `customer-journey-refresh.css`, `milk-transition.css` | `checkout.js`, customer navigation, Supabase/resilience/session/PWA/network runtime |
| Milk detail | `product.html`, `product/index.html` | `styles.css`, `experience-layer.css`, `market.css`, `customer-journey-refresh.css`, `milk-transition.css` | `product.js`, customer navigation, shared Supabase/resilience/session/PWA/network runtime |
| Seller/store details | `store.html`, `store/index.html` | Same customer detail stack as product, plus Leaflet CSS | `store.js`, customer navigation, Leaflet JS, shared runtime |
| Milk plans/subscriptions | `plans.html`, `plans/index.html` | `styles.css`, `experience-layer.css`, `plans.css`, `subscription-schedule-preview.css`, `customer-journey-refresh.css`, `customer-ui-polish.css`, `milk-transition.css` | `plans.js`, customer navigation, shared runtime |
| Orders/tracking/payment choice | `orders.html`, `orders/index.html` | `styles.css`, `experience-layer.css`, `orders.css`, `customer-journey-refresh.css`, `direct-upi-checkout.css`, `customer-ui-polish.css`, `milk-transition.css` | `orders.js`, `direct-upi-checkout.js`, customer navigation/10x helper, QRCode, shared runtime |
| Notifications | `notifications.html`, `notifications/index.html` | `styles.css`, `notifications.css`, `milk-transition.css` | `notifications.js`, shared Supabase/resilience/PWA/transition |
| Help and support | `support.html`, `support/index.html` | `styles.css`, `support.css`, `milk-transition.css` | `support.js`, shared runtime |
| Legal/policy pages | `legal.html`, `legal/index.html` | `styles.css`, `milk-transition.css` | Primarily static page plus resilience/PWA/network/transition |
| Seller onboarding/operations | `provider.html`, `provider/index.html` | `styles.css`, `experience-layer.css`, `provider.css`, `milk-transition.css`, Leaflet CSS | `provider.js`, `provider-location.js`, shared Supabase/resilience/PWA/network/transition |
| Owner/admin console | `admin.html`, `admin/index.html` | `styles.css`, `admin.css`, `milk-transition.css` | `admin.js`, `admin-intelligence.js`, shared Supabase/resilience/PWA/network/transition |
| Offline fallback | `offline.html`, `offline/index.html` | No external stylesheet/script links identified in page source; standalone inline fallback | Standalone offline explanation/link back to app |

### Shared runtime boundaries

- **Data/auth:** `supabase-config.js`, `supabase-client.js`, `auth.js`, `session-controls.js`.
- **Resilience/PWA:** `resilience.js`, `network-status.js`, `pwa-register.js`, `sw.js`.
- **Customer shell/navigation:** `customer-nav.js` and customer page scripts.
- **Motion:** `milk-transition.css/js` shared by many routes; treat it as a high-blast-radius component.
- **Seller/admin:** `provider.js` and `admin.js` are separate role-specific owners. Shared visual primitives must not merge their permissions/flows or blur role boundaries.

## 8. Specific source-level findings to turn into tickets

### P1 — PWA styling cache coverage
- [x] **Homepage refresh CSS precache verified:** `index.html` imports `/Doodhwala/marketplace-refresh.css?v=20261025.3`, and the exact URL is present in `sw.js` `CORE_ASSETS` (though not in `ASSETS`). There is no identified precache omission from this check. The real gap was test coverage: `scripts/test-pwa-offline-contracts.mjs` did not assert this critical core asset. PR #117 adds the explicit contract assertion.
- [x] Extend `scripts/test-pwa-offline-contracts.mjs` to assert the homepage's `marketplace-refresh.css?v=20261025.3` URL is present in the service-worker asset contract. Broader HTML-to-manifest consistency checking remains a separate follow-up; the current test does not prove every page asset is precached.\n- [ ] Review all current HTML query-string asset URLs against `ASSETS` and `CORE_ASSETS`, not just filenames. The service worker currently contains multiple historic versioned keys (for example different `styles.css`, `provider.css`, `plans.js`, `customer-nav.js`, `resilience.js` and `customer-ui-polish.css` variants). Keep only needed compatibility entries after testing cache migration and old-client recovery.
- [ ] Add a release test that detects an imported local CSS/JS URL omitted from the service-worker manifest and distinguishes core shell assets from optional enhancements.

### P1 — CSS ownership and design-token fragmentation
- [ ] `styles.css` establishes base tokens such as `--bg`, `--surface`, `--ink`, `--muted`, `--line`, `--green`, shadows and radii.
- [ ] `marketplace-refresh.css` separately declares `--market-*` tokens; `customer-journey-refresh.css` declares `--retail-*` tokens; individual page styles also contain hard-coded colors.
- [ ] `customer-ui-polish.css` contains targeted `!important` overrides. Preserve intentional contrast fixes, but document ownership and remove overrides only after screenshot/regression verification.
- [ ] `experience-layer.css` applies transitions/focus/interaction rules across broad selectors (buttons, links, inputs and role=button elements). Treat it as global behaviour and verify every role/route before changing.
- [ ] Home has the deepest visual cascade. Page stacks differ by route; do not blindly add glass effects globally. Define tokens first, then migrate one workstream/route group at a time.
- [ ] `milk-transition.css/js` is shared widely and creates a high-z-index transition overlay. Motion refactors must retain reduced-motion, interruption cleanup, back/forward navigation and non-blocking navigation.

### P1 — external runtime and graceful fallback
- [ ] Google Fonts are requested through a CSS import; preserve system fallbacks and confirm the interface remains readable when fonts/network are unavailable.
- [ ] Supabase JS, Leaflet and QRCode arrive from external CDNs on routes that need them. UI changes must retain visible failure/retry states and not assume a CDN/network is always available.
- [ ] Do not introduce new paid libraries/APIs for visual effects. Prefer CSS and existing assets; blur/glass must fall back cleanly on constrained devices.

## 9. Audit completion status

| Audit item | Status | Evidence / outstanding step |
|---|---|---|
| Tracked repository inventory | **Complete** | 237 tracked files inventoried; user-facing HTML/CSS/JS and CI/PWA areas identified |
| Main route and style/script imports | **Complete for listed public route HTML** | 13 route families mapped above, including root and directory-style aliases |
| Root/clean-route entry-point content parity | **Source-verified for the 12 listed aliases** | Matching Git blob SHAs observed for root HTML and corresponding `index.html` files |
| Initial CSS token/layer ownership | **Source-reviewed** | Base tokens plus `--market-*` and `--retail-*` extensions, broad interaction layer, high specificity customer overrides |
| Service-worker asset manifest vs route imports | **One critical asset contract added; broader audit pending** | Homepage refresh CSS is already in `CORE_ASSETS`; PR #117 adds a regression assertion. Full route-to-manifest coverage remains unverified |
| Visual/browser screenshots for all routes | **Not yet done** | Need real browser run, screenshots, mobile/tablet/desktop inspection |
| Keyboard/contrast/accessibility audit | **Not yet done** | Needs automated and manual execution, not inference from source |
| Auth/RLS/checkout/order live staging E2E | **Not yet done by this UI audit** | Must use authorized staging accounts; no synthetic production data |
| CI for the planning documentation PR | **Pending** | Run checks on the planning branch/PR before approval; UI implementation remains out of scope |

## 10. First implementation PR acceptance rules

The first implementation PR is limited to shared token/component foundations and audit-derived tests. It must not change payment, order, auth, provider approval, admin authorization, database schemas or real customer data. Before merging, compare screenshots for home, auth, product/store, checkout/orders, plans, provider and admin; verify clean URLs and root aliases; test reduced motion and offline asset contracts; and require every relevant CI check to pass on the exact PR head.


## 11. Proposed design-token contract (planning draft, not yet implemented)

Reuse existing brand values where sensible rather than inventing a second palette. These values are a proposed starting point and must be checked against contrast and screenshot evidence before being applied.

| Token | Proposed value / mapping | Usage |
|---|---|---|
| `--dw-canvas` | `#f5f7f3` (existing `--bg`) | Main app background |
| `--dw-surface` | `#ffffff` (existing `--surface`) | Forms, main content cards, tables and critical task surfaces |
| `--dw-surface-soft` | `#f8faf7` (existing `--surface-2`) | Quiet inset surfaces |
| `--dw-text` | `#17221a` (existing `--ink`) | Primary text |
| `--dw-text-muted` | `#6f7c73` (existing `--muted`) | Supporting text; validate small-text contrast before use |
| `--dw-border` | `#e2e8e1` (existing `--line`) | Dividers and card boundaries |
| `--dw-brand` | `#17603f` (existing `--green`) | Primary action and key brand accent |
| `--dw-brand-strong` | `#10482f` (existing `--green-dark`) | Active/pressed and high-emphasis brand states |
| `--dw-brand-soft` | `#e3f1e7` (existing `--green-soft`) | Soft selection and status backgrounds |
| `--dw-warning` | `#b47716` (existing `--amber`) | Warning states only; confirm contrast for text usage |
| `--dw-danger` | `#a3483e` (existing `--danger`) | Destructive/error states |
| `--dw-glass-bg` | `rgba(255,255,255,.76)` | Headers, floating navigation, location panels and selected overlays |
| `--dw-glass-border` | `rgba(255,255,255,.78)` plus a visible neutral border fallback | Separation against variable backgrounds |
| `--dw-glass-blur` | `16px` | Optional glass surfaces only; keep blur count low on mobile |
| `--dw-radius-sm / --dw-radius / --dw-radius-lg` | `10px / 16px / 22px` | Inputs, standard cards, dialogs/feature panels |
| `--dw-motion-fast / --dw-motion-ui` | `150ms / 220ms` | Press/hover feedback and ordinary transitions |
| `--dw-motion-ease` | `cubic-bezier(.2,.75,.25,1)` | Shared easing for ordinary UI transitions |

### Glass rules
- Keep the default content surface opaque. Use glass selectively for app headers, floating navigation, location pickers, small utility overlays and the startup/transition layer.
- Do not put translucent blur behind core reading surfaces, checkout totals, form labels, prices, seller order statuses, data tables or error/success messages.
- Always retain a visible edge against both light and green-tinted backdrops; the glass layer cannot be the only source of separation.
- Add `@supports` fallback to a solid/high-opacity surface for browsers without `backdrop-filter`, and verify colour contrast without blur.
- Avoid stacking multiple blurred layers; on smaller/low-end devices, prefer less blur rather than adding runtime work.

### Cinematic motion rules
- Brand intro and page transition are the only allowed cinematic sequences. They must be skippable or short, cannot hide an error, cannot block route changes, and must clean up on interruption/page lifecycle events.
- Everyday actions (filtering, quantity change, accepting an order, submitting checkout) use immediate feedback and short transitions. Do not make functional controls wait for decorative animations.
- Honour `prefers-reduced-motion: reduce` on every layer, not just the splash screen. Avoid large parallax, repeated card choreography and motion that obscures order status.
- Animation performance gate: inspect on a lower-end mobile profile, avoid layout-thrashing animations, and verify content remains usable if animations never run.

### Density and responsive contract
- Base spacing steps: `4, 8, 12, 16, 20, 24, 32, 40, 48px`; no page-specific random spacing values unless there is a documented reason.
- Use a balanced content density: readable sections and card groups, but no oversized vertical gaps that hide customer/provider tasks below the fold.
- Maintain primary task access at small phone widths, handle safe-area insets, avoid horizontal overflow, and support browser zoom / enlarged text.
- Keep DM Sans as the body typeface and Manrope as the heading/brand typeface unless a measured readability issue suggests otherwise; system fallbacks must always work.



## Migration note

- These sections preserve the source material from the former root TASK_BOARD.md, CODING_AGENT_GUIDE.md, PWA_OFFLINE_AUDIT.md, docs/DAILY_DELIVERY_FUNCTIONALITY_AUDIT.md, and docs/UI_CLEANUP_MASTER_PLAN.md.
- Historical PR links, cache revisions, statuses, and test outcomes are snapshots, not current truth. Always verify the exact current commit and latest CI before acting.
- Do not recreate separate task, UI-plan, PWA-audit, or daily-delivery-audit documents. Update this master plan for durable roadmap/audit context, VAIDIK_TASKS.md for assignments/status, and DAILY_PROGRESS.md for dated progress.
