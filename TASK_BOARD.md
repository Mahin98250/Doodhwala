# Doodhwala Team Task Board

> Shared source of truth for Mahin, teammates, and coding agents. Keep this file current in the same PR as task-related changes.
> Last updated: 2026-10-26
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
  **Evidence:** PR/Issue: add link · Checks: not run.

- [ ] **DW-003 — Service worker and offline/reconnect validation** ([Issue #75](https://github.com/Mahin98250/Doodhwala/issues/75))  
  **Owner:** Unassigned · **Status:** TODO · **Area:** PWA / QA  
  **Goal:** Confirm the latest assets replace stale cached assets and the UI explains offline status accurately.  
  **Done when:** Fresh install, update from previous cache, offline navigation, and reconnect are tested on a real or clearly identified browser/device. Do not imply offline orders are queued unless implemented.  
  **Evidence:** PR/Issue: add link · Checks: not run.

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
