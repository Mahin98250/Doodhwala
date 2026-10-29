# DW-005 — Asynchronous UI State Audit

**Status:** IN REVIEW — automated checks passed on implementation commit  
**Owner:** Vaidik Patel (@vaidikpatel22112010-tech)  
**Branch:** `feat/dw-005-async-ui-states-20261029`  
**Issue:** [#77](https://github.com/Mahin98250/Doodhwala/issues/77)

## Affected screens identified before implementation

This focused pass covers two existing customer-facing screens with asynchronous actions. It does not attempt a whole-app rewrite.

| Screen / route | Async action | Current risk to verify | Expected truthful states |
|---|---|---|---|
| Help & Support — `/Doodhwala/support/` | Load signed-in user's support-request history; submit a support ticket | History can fail without an actionable retry in the list; submission currently displays success even if the RPC response lacks a ticket identifier, so the client cannot confirm what was recorded | Loading with busy indication; signed-out guidance; explicit empty state; failure with retry; success only after a valid ticket response; submit button protected against duplicate submissions |
| Notifications — `/Doodhwala/notifications/` | Mark one notification read; mark all read; refresh/load older notifications | If the write succeeds but the follow-up list refresh fails, the UI can report the write as failed even though it may have succeeded | Busy/disabled actions; success state based on write result; distinguish write failure from refresh failure; retain retry/refresh path; empty state only after a successful load |

## Implementation boundaries

- Preserve existing Supabase RPC names, auth/session requirements, routes, and payment/order behavior.
- Do not change database schema, migrations, authorization, or production data.
- Keep status text available to assistive technology using existing `role=status`, `aria-live`, and alert regions; expose busy state where applicable.
- Test both mutation failure and mutation success followed by refresh failure with mocks; do not treat a successful HTTP/RPC response without the expected support-ticket ID as confirmed success.
- Add source-contract coverage and automated checks to CI. Record browser screenshots only if a browser workflow actually runs; otherwise record as NOT RUN.

## Evidence

- Baseline inspection: `support.js`, `support.html`, `notifications.js`, `notifications.html`, `scripts/test-support-center.mjs`, `scripts/test-customer-ui-fixes.mjs`, and `.github/workflows/static-validation.yml`.
- Implementation and tests: [Draft PR #152](https://github.com/Mahin98250/Doodhwala/pull/152), branch `feat/dw-005-async-ui-states-20261029`.
- Added `scripts/test-async-ui-states.mjs` to exercise confirmed support-ticket success, incomplete response/no false success, notification write failure, and successful write followed by failed refresh.
- Added `support-async-states.png` and `notifications-async-states.png` screenshot capture to `scripts/test-pwa-browser-smoke.mjs`; artifacts remain pending CI execution.
- Added exact versioned support/notification runtime URLs to the service-worker precache and advanced cache revision to `doodhwala-v111`.
- CI passed on implementation commit `c3dbaac08ae26021311aa14d6673ac3955ea3360`: [Static validation](https://github.com/Mahin98250/Doodhwala/actions/runs/40903082129), [notification validation](https://github.com/Mahin98250/Doodhwala/actions/runs/40903082202), [SQL validation](https://github.com/Mahin98250/Doodhwala/actions/runs/40903082269), and [PWA browser evidence](https://github.com/Mahin98250/Doodhwala/actions/runs/40903082490).
- Screenshots/results artifact: [doodhwala-pwa-browser-evidence](https://github.com/Mahin98250/Doodhwala/actions/runs/40903082490/artifacts/12910481047) (includes the Support and Notifications async-state screenshots plus JSON results).
- Vercel preview status remains failed due to provider build-rate limit; this does not affect the passing GitHub Actions jobs but the preview cannot be used until the limit is resolved.
- Manual signed-in / signed-out testing: not run; requires an approved authenticated environment.
