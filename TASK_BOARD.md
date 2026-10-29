# Doodhwala Team Task Board

> Shared source of truth for Mahin, teammates, and coding agents. Keep this file current in the same PR as task-related changes.
> Last updated: 2026-10-29
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
  **Owner:** Vaidik Patel (@vaidikpatel22112010-tech) · **Status:** IN PROGRESS · **Area:** Customer UI / QA  
  **Branch:** `vaidik/dw-002-ui-ux-audit-current-main` · **PR:** [#139](https://github.com/Mahin98250/Doodhwala/pull/139)  
  **Goal:** Check navigation, buttons, forms, loading/empty/error states, and mobile/desktop layouts without duplicating existing findings.  
  **Evidence:** PR #139 has source-confirmed findings and Chromium viewport/interaction coverage; its latest documented browser/static checks passed on `7f88c7781d96857e681481a96deebca2c8c257ce`. The current branch head `cd7933772eca6048578910c6af2a2e8b05c03328` is two commits ahead, changing `customer-nav.js` and the browser test; re-run checks on that exact head before acceptance. Physical Android/iOS, keyboard/screen-reader, measured touch targets, full provider-form validation, live backend search/cart totals and authenticated staging remain NOT RUN/BLOCKED.

- [ ] **DW-003 — Service worker and offline/reconnect validation** ([Issue #75](https://github.com/Mahin98250/Doodhwala/issues/75))  
  **Owner:** Vaidik Patel (@vaidikpatel22112010-tech) · **Status:** IN PROGRESS · **Area:** PWA / QA  
  **Branch:** `fix/dw-003-audit-cache-revision` · **Audit PR:** [#112](https://github.com/Mahin98250/Doodhwala/pull/112) · **Older implementation PR:** [#90](https://github.com/Mahin98250/Doodhwala/pull/90)  
  **Goal:** Confirm the latest assets replace stale cached assets and the UI explains offline behavior accurately.  
  **Evidence:** PR #112 was refreshed against main SHA `dba11d39ae149d0b57fb36003da7d9330aba8b0b`; exact-main static, PWA browser, SQL, notification, Pages workflow and scheduled live smoke all passed (details in `PWA_OFFLINE_AUDIT.md`). PR #90's v95 branch is stale and must not be merged as-is. Physical Android/iOS install/update, update with an older tab open and manual reconnect freshness remain NOT RUN; no offline order queue is claimed.

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
  **Owner:** Vaidik Patel (@vaidikpatel22112010-tech) · **Status:** IN PROGRESS · **Area:** UX  
  **Branch:** `vaidik/dw-005-ui-state-sprint-20261029` · **PR:** [#147](https://github.com/Mahin98250/Doodhwala/pull/147)  
  **Goal:** Make asynchronous actions understandable while preserving existing behavior and accessibility.  
  **Current focused slice:** Profile → Personal details has a retryable initial-load error state, locked fields until data loads, truthful informational read feedback, and a VM regression that exercises failed-read → retry-success without calling the RPC. Parent PR #147 bumps the cache to v111; stacked P1 follow-up [PR #148](https://github.com/Mahin98250/Doodhwala/pull/148) adds About and transparent account-deletion help navigation and bumps the cache to v112. PR #148 depends on PR #147 being reviewed/merged first. The Support link is guidance only; it does not submit or perform account deletion.  
  **Parent verification on code SHA `105de7299e8936aa7f78798b541216008228a3a4`:** Static validation PASS [run 40897115651](https://github.com/Mahin98250/Doodhwala/actions/runs/40897115651); PWA offline Chromium smoke PASS [run 40897115563](https://github.com/Mahin98250/Doodhwala/actions/runs/40897115563) with [screenshots/results artifact](https://github.com/Mahin98250/Doodhwala/actions/runs/40897115563/artifacts/12907243012); notification UI/migration validation PASS [run 40897115562](https://github.com/Mahin98250/Doodhwala/actions/runs/40897115562); disposable PostgreSQL validation PASS [run 40897115599](https://github.com/Mahin98250/Doodhwala/actions/runs/40897115599). The stacked v112 route changes need their own CI results. Authenticated persistence and physical-device checks remain NOT RUN/BLOCKED.

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
| 2026-10-29 | DW-005 Profile load/retry states | Vaidik Patel (@vaidikpatel22112010-tech) | Added retryable initial-load failures, locked fields until data loads, truthful informational read feedback, cache v111, and a mocked UI-state regression; refreshed related PWA cache expectations and current-main PWA audit evidence. | [PR #147](https://github.com/Mahin98250/Doodhwala/pull/147), tested code SHA `105de7299e8936aa7f78798b541216008228a3a4`: Static PASS [40897115651], PWA Chromium PASS [40897115563], notification UI/migration PASS [40897115562], disposable PostgreSQL PASS [40897115599]. Authenticated persistence and physical-device acceptance remain NOT RUN/BLOCKED. |
| 2026-10-29 | Profile destination completeness (stacked follow-up) | Vaidik Patel (@vaidikpatel22112010-tech) | Added an About destination using existing marketplace purpose copy, corrected Account deletion help to route to Support with explicit no-deletion disclosure, exposed the existing grievance fragment, and refreshed the service-worker cache to v112. | [PR #148](https://github.com/Mahin98250/Doodhwala/pull/148), stacked on PR #147; source/route/PWA checks pending on the exact stacked head. This does not implement account deletion or change policy wording. |
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
