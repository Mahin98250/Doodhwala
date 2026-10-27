# Vaidik Patel — Consolidated Doodhwala Work Plan

**Owner:** Vaidik Patel (`vaidikpatel22112010-tech`)  
**Project lead / approval authority:** Mahin  
**Prepared:** 27 October 2026  
**Purpose:** One source of truth for the outstanding QA, PWA, UI, CI, and release-readiness work identified in the latest review.

## Working rules (mandatory)

1. Work in small, reviewable changes. Prefer one PR per coherent task; avoid broad PRs mixing animations, service-worker revisions, application logic, and test changes.
2. Do not merge PRs, deploy, change production configuration/data, run synthetic tests against production, or perform real-money payments. Mahin must review and approve merges/deployments.
3. Do not bypass security, staging, or CI gates. Never weaken/delete tests merely to make CI green.
4. Report evidence, not assumptions. For each check record the commit SHA, workflow/run URL, environment, exact result, and any limitations.
5. Mark checks as **PASS**, **FAIL**, **BLOCKED**, or **NOT RUN**. A CI pass is not proof of production deployment or a manually tested user journey.
6. Do not expose secrets, tokens, customer data, or payment details in logs, screenshots, issues, or artifacts.
7. If blocked, document the missing prerequisite, evidence of the blocker, and the exact decision/access needed from Mahin. Continue only with safe preparatory work.

## Priority order

- **P0-A — Diagnose current CI failures on PR #113** (coordination/report only unless explicitly authorized by the PR owner).
- **P0-B — Consolidate duplicate release-evidence PRs #111 and #114.**
- **P0-C — Reconcile PWA work across #106, #90, and #112; update issue #75.**
- **P0-D — Prepare secure staging E2E tests; execution remains BLOCKED until an isolated staging project is approved and verified.**
- **P1-A — Finish the customer/seller responsive UI and accessibility audit in #88.**
- **P1-B — Reconcile task board and issue statuses with evidence.**
- **Final gate — Produce a single evidence-backed release-readiness report; do not declare release-ready while mandatory gates are blocked.**

---

## Task 1 — P0: Diagnose failing transition/PWA CI on PR #113

**Reference:** https://github.com/Mahin98250/Doodhwala/pull/113  
**Status at review:** Open/draft; static validation, notification validation, and PWA offline-browser evidence were reported failing. The reviewed branch used `doodhwala-v103` while some test expectations still referenced `v102`.

### Scope
- Reproduce the failures on the current PR head and capture the exact SHA.
- Compare `sw.js`, cache-version assertions, offline fallback expectations, notification asset/route contracts, and test fixtures.
- Classify each failure as stale expectation, real defect, or both.
- Give the PR owner a minimal fix recommendation. Do not push changes to another contributor's branch unless the owner explicitly authorizes it.
- Inspect the complete diff for unrelated changes and stale test assumptions.

### Tests to run
- `node scripts/test-pwa-offline-contracts.mjs`
- `node scripts/test-service-worker.mjs`
- `node scripts/validate-site.mjs`
- `node scripts/test-notifications.mjs`
- `node scripts/test-pwa-browser-smoke.mjs`
- The relevant complete GitHub Actions workflows on the candidate commit.

### Acceptance criteria
- Each failure is reproducible and explained with log evidence.
- Service-worker cache version and all related assertions agree.
- The offline fallback is found in the active cache and offline navigation is verified.
- Static validation, notification validation, and PWA browser evidence all pass on the exact candidate SHA.
- Browser evidence is attached as a CI artifact.
- No test is removed or weakened to force a pass.

**Release gate:** Do not recommend merge while required workflows fail.

## Task 2 — P0: Consolidate release-evidence PRs #111 and #114

**References:**  
- https://github.com/Mahin98250/Doodhwala/pull/111  
- https://github.com/Mahin98250/Doodhwala/pull/114

### Scope
- Compare both diffs and identify unique, valid information in each.
- Preserve useful unique content and choose one canonical evidence-update PR.
- Recommend closing the duplicate only after verifying no information is lost; do not close or merge either PR without Mahin's approval.
- Ensure evidence cites the exact tested commit and workflow run.
- Explicitly separate static/SQL/browser CI results from GitHub Pages deployment and manual end-to-end testing.

### Acceptance criteria
- One clearly identified canonical PR is recommended.
- Evidence and limitations from both drafts are preserved where valid.
- Every result has a commit SHA, workflow URL, result, and scope.
- Staging-blocked and not-run tests remain clearly marked.
- Vercel status checks are reported as separate from GitHub Pages verification.
- No claim says “release-ready” based only on green CI.

## Task 3 — P0: Reconcile PWA work and update issue #75

**References:**  
- Merged PWA fix #106: https://github.com/Mahin98250/Doodhwala/pull/106  
- Older PWA branch #90: https://github.com/Mahin98250/Doodhwala/pull/90  
- PWA audit documentation #112: https://github.com/Mahin98250/Doodhwala/pull/112  
- Issue #75: https://github.com/Mahin98250/Doodhwala/issues/75

### Scope
- Compare #90 and #112 against current main and merged implementation #106.
- Identify unique changes that are still missing; do not merge an outdated branch merely because historical checks passed.
- Recommend whether remaining unique changes should be ported into a small PR or the old PR should be superseded.
- Update issue #75 and the task board with evidence-based status.

### Tests
- Service-worker cache isolation; do not delete unrelated origin caches.
- Required core assets and offline fallback.
- Cache writes complete before a successful response is relied upon.
- Query-string asset persistence.
- Offline navigation, offline/reconnect messaging, and fresh reload.
- Fresh install, update from previous cache, and update while an older tab is open.
- Re-run current PWA browser and service-worker tests on main/candidate SHA.

### Acceptance criteria
- Current cache revision is consistent across worker, tests, and documentation.
- Current contracts pass on the exact SHA and browser artifacts are retained.
- No unsupported promise that orders or payments work offline.
- Physical Android/iOS installed-PWA checks are recorded with device/browser details if available; otherwise mark **BLOCKED/NOT RUN**, never PASS.
- Superseded PR recommendations explain how unique changes were checked.

## Task 4 — P1: Finish responsive customer/seller UI and accessibility audit

**References:**  
- PR #88: https://github.com/Mahin98250/Doodhwala/pull/88  
- Issue #74: https://github.com/Mahin98250/Doodhwala/issues/74

### Scope
Use approved demo/fixture data only. Test the customer and milk-seller journeys, focusing on simple daily use and clear feedback.

- Product detail, price, stock/unavailable states.
- Search and selection; empty results and retry.
- Cart quantity changes and accurate subtotal/total.
- Authentication form validation and accessible errors.
- Checkout required-field validation; do not initiate real payment.
- Seller setup and seller order navigation.
- Loading, empty, error, success, and offline/reconnect states.
- Responsive layouts at 320, 390, 768, 1024, and 1440 CSS pixels.
- Keyboard focus order, visible focus, accessible names, screen-reader labels where available, touch targets, and reduced-motion preference.

### Acceptance criteria
- Each test records steps, expected result, actual result, and PASS/FAIL/BLOCKED.
- Relevant screenshots or browser artifacts are attached without secrets or real customer data.
- Automated browser checks pass on the exact PR head.
- Physical device and screen-reader checks are recorded if available; otherwise marked not run.
- Bugs are fixed in focused commits or listed as follow-up tasks with severity and reproduction steps.
- PR #88 remains draft until required checks are complete and the diff is reviewable.

## Task 5 — P0, BLOCKED: Prepare secure staging end-to-end validation

**References:**  
- Release validation #94: https://github.com/Mahin98250/Doodhwala/issues/94  
- Customer-to-seller journey #73: https://github.com/Mahin98250/Doodhwala/issues/73  
- RLS/authorization review #79: https://github.com/Mahin98250/Doodhwala/issues/79  
- Payment readiness #78: https://github.com/Mahin98250/Doodhwala/issues/78  
- Staging baseline: https://github.com/Mahin98250/Doodhwala/blob/main/docs/STAGING_BASELINE.md  
- Payment readiness: https://github.com/Mahin98250/Doodhwala/blob/main/PAYMENT_SECURITY_READINESS.md

**Known blocker:** An isolated, approved Supabase staging project has not been provisioned and verified. Do not work around this by testing production.

### Safe preparation now
- Prepare a test matrix for customer A/B, seller A/B, and non-admin/admin roles.
- List required migrations, RPCs, RLS policies, notification/realtime behavior, and prerequisites.
- Design negative tests for cross-customer and cross-seller data access.
- Prepare duplicate-order/retry, order-state persistence, subscription pause/skip, and payment-state cases.
- Define staging safety checks and cleanup procedures before execution.

### Execute only after Mahin confirms staging is isolated and approved
- Customer checkout through seller acceptance and order tracking using synthetic accounts.
- Deployed RLS/RPC authorization checks for all relevant roles.
- Duplicate submission and retry behavior.
- Subscription schedule, pause/skip, and local-date cutoff behavior.
- Notification and Realtime updates.
- Bounded performance tests and backup/restore validation, only after explicit staging approval.

### Acceptance criteria
- Each run records tested commit, environment, role, steps, expected/actual result, and artifact.
- No production customer data, synthetic production orders, real-money payments, or production load tests.
- Cross-role authorization failures are explicitly tested.
- Schema/migration discrepancies are documented, not bypassed.
- Unavailable tests are marked **BLOCKED** with the missing prerequisite and requested decision.

**Release gate:** Authenticated E2E remains BLOCKED until the isolated staging target is verified and approved. Payment launch remains blocked until the payment/security readiness gates are independently satisfied.

## Task 6 — P1: Reconcile task board and linked issue statuses

**Reference:** https://github.com/Mahin98250/Doodhwala/blob/main/TASK_BOARD.md

### Scope
Compare the task board with merged PRs, open PRs, issue #94, and current CI evidence. In particular, review status/ownership for DW-003, DW-011, the responsive UI audit, PWA work, and release validation.

### Acceptance criteria
- Every task has one accurate status: TODO, IN PROGRESS, BLOCKED, IN REVIEW, or DONE.
- DONE requires merged implementation plus the relevant acceptance evidence; an open PR or green isolated CI alone is insufficient.
- BLOCKED entries name the missing dependency and decision owner.
- PRs/issues are linked; duplicate work is identified.
- No status is changed to DONE just to make the board look complete.

## Task 7 — Final deliverable: Release-readiness report

Create/update one report linked from issue #94 after the tasks above are assessed.

It must include:
- Current main SHA and candidate PR SHAs.
- CI workflow URLs and exact results.
- GitHub Pages build/deployment evidence as a separate category.
- Manual/device results, with device/browser details.
- Security/RLS/payment/staging results.
- Open blockers, severity, owner, next action, and required approval.
- A clear recommendation: READY FOR REVIEW, BLOCKED, or NOT READY FOR RELEASE.

**Acceptance criteria:** Every claim is backed by evidence; no missing evidence is guessed. Release recommendation remains NOT READY/BLOCKED while required staging, authorization, payment, or CI gates are unresolved.

---

## Progress reporting format

For each task, report:

- **Status:** PASS / FAIL / BLOCKED / NOT RUN
- **Branch / PR / commit SHA:**
- **Changes made:**
- **Tests run and results:**
- **Evidence URLs / artifacts:**
- **Remaining gaps:**
- **Blocker and exact decision needed:**
- **Next action:**

## Definition of done

The work is complete only when the acceptance criteria for each task are evidenced, duplicate/stale work is reconciled, the task board is accurate, and the release report clearly identifies unresolved gates. Completing documentation does not substitute for running tests. Passing CI does not substitute for staging or manual verification. Final merge/deployment decisions remain with Mahin.
