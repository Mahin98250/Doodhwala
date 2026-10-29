# DW-005 — UI state audit and evidence

**Date:** 2026-10-29  
**Owner:** Vaidik Patel (@vaidikpatel22112010-tech)  
**Branch:** `vaidik/dw-005-ui-state-sprint-20261029`  
**Issue:** [#77](https://github.com/Mahin98250/Doodhwala/issues/77)  
**Scope boundary:** frontend HTML/CSS/JavaScript, source-contract tests, PWA client cache logic, and documentation only. No database/RPC/auth-policy behavior, production configuration/data, deployment, orders, or payments changed.

## Finding DW-005-PROFILE-01 — personal details load failure has no in-screen retry

- **Route/files:** `/Doodhwala/profile/details/`; `profile/details/index.html`, `profile-details.js`.
- **Viewport/browser:** source review only; no interactive browser/device was available for this run. Responsive CSS is defined for widths below 440px, but rendered layout is **NOT RUN**.
- **Reproduction (source-confirmed path):** open Personal details with the secure client unavailable or make the initial session/profile/default-address read reject.
- **Expected:** a truthful error message, a clear retry action, and no editable form that appears ready to save before the existing account details have loaded.
- **Actual before fix:** an error was shown and Save was disabled, but there was no in-screen retry control; fields remained editable while the initial read had failed. A successful read also used a `success` status for a “details loaded” informational message.
- **Severity:** P1 (account editing is blocked by a recoverable read failure; the status role should not imply that a save occurred).
- **Fix in this branch:** add a keyboard-accessible retry action shown only for initial-load failures; retry the existing read flow without touching persistence; disable profile fields while initial data is unavailable; announce a successful read as informational status; bump the service-worker cache to `doodhwala-v111` and precache the versioned runtime `profile-details.js?v=20261029.2`.
- **Regression coverage added:** `scripts/test-profile-details-contract.mjs` asserts retry wiring, field locking, and truthful status semantics. `scripts/test-pwa-offline-contracts.mjs` asserts the new cache revision and exact versioned runtime URL.

## Verification matrix

| Check | Exact command/environment | Result | Evidence / limitation |
|---|---|---|---|
| Profile source-contract regression | `node scripts/test-profile-details-contract.mjs` in GitHub Actions / repository CI | PENDING CI | Do not mark PASS until the workflow finishes on the PR head. |
| PWA source-contract regression | `node scripts/test-pwa-offline-contracts.mjs` in GitHub Actions / repository CI | PENDING CI | Do not mark PASS until the workflow finishes on the PR head. |
| Site validation / JS syntax | Repository's existing Static validation workflow on exact PR head | PENDING CI | Record workflow URL and tested SHA in the PR. |
| Profile read/write persistence | Authenticated customer browser session in an approved non-production test environment | BLOCKED / NOT RUN | Requires an approved test account/session and an explicitly permitted isolated test environment. This sprint does not test or alter RPC/database behavior. |
| Mobile/tablet/desktop visual check | Real browser/device at 320, 390, 768, 1024, and 1440 CSS px | NOT RUN | CI/source contracts are not physical-device or full visual proof. |
| Installed PWA update/offline/reconnect | Identified browser/device, previous cache, airplane/offline toggle, reconnect + reload | NOT RUN | Cache contract is updated; installed-PWA lifecycle acceptance still needs a browser/device run. |

## Remaining sprint coverage — not claimed complete

- Customer/provider route matrix, all buttons/forms/dialogs, provider forms, cart/checkout-entry UI, accessibility keyboard/screen-reader/contrast/touch-target checks, and rendered overflow checks still require their own evidence.
- DW-002 responsive source/Chromium work is already in [PR #139](https://github.com/Mahin98250/Doodhwala/pull/139); do not duplicate its findings or overwrite its branch.
- DW-003 PWA implementation/audit is already represented by [PR #90](https://github.com/Mahin98250/Doodhwala/pull/90) and [PR #112](https://github.com/Mahin98250/Doodhwala/pull/112), while merged source has advanced beyond those older cache revisions. Reconcile their unique coverage against current main before deciding whether to port or supersede anything.
- Support, notifications, discovery/search, provider cards, cart and checkout need focused follow-up audit/fixes if reproducible gaps remain. No full-app or release-ready claim is made by this slice.
