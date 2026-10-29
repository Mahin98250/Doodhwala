# DW-005 — UI state audit and evidence

**Date:** 2026-10-29  
**Owner:** Vaidik Patel (@vaidikpatel22112010-tech)  
**Branch:** `vaidik/dw-005-ui-state-sprint-20261029`  
**Issue:** [#77](https://github.com/Mahin98250/Doodhwala/issues/77)  
**Scope boundary:** frontend HTML/CSS/JavaScript, source-contract tests, PWA client cache logic, and documentation only. No database/RPC/auth-policy behavior, production configuration/data, deployment, orders, or payments changed.

## Finding DW-005-PROFILE-01 — personal details load failure has no in-screen retry

- **Route/files:** `/Doodhwala/profile/details/`; `profile/details/index.html`, `profile-details.js`.
- **Viewport/browser:** source review plus automated CI only; no manual interactive browser or physical device was used for this finding. Responsive CSS is defined for widths below 440px, but the profile route's rendered layout is **NOT RUN**.
- **Reproduction (source-confirmed path):** open Personal details with the secure client unavailable or make the initial session/profile/default-address read reject.
- **Expected:** a truthful error message, a clear retry action, and no editable form that appears ready to save before the existing account details have loaded.
- **Actual before fix:** an error was shown and Save was disabled, but there was no in-screen retry control; fields remained editable while the initial read had failed. A successful read also used a `success` status for a “details loaded” informational message.
- **Severity:** P1 (account editing is blocked by a recoverable read failure; the status role should not imply that a save occurred).
- **Fix in this branch:** add a keyboard-accessible retry action shown only for initial-load failures; retry the existing read flow without touching persistence; disable profile fields while initial data is unavailable; announce a successful read as informational status; bump the service-worker cache to `doodhwala-v111` and precache the versioned runtime `profile-details.js?v=20261029.2`.
- **Regression coverage added:** `scripts/test-profile-details-contract.mjs` asserts retry wiring, field locking, and truthful status semantics. `scripts/test-pwa-offline-contracts.mjs` asserts the new cache revision and exact versioned runtime URL.

## Finding DW-005-PROFILE-02 — About was undiscoverable and Account deletion linked back to sign-in

- **Route/files:** /Doodhwala/profile/; profile/index.html; new /Doodhwala/about/ (about/index.html); sw.js.
- **Viewport/browser:** source/route review only; no manual signed-in browser session was used for this finding.
- **Reproduction:** open Profile and select “Account deletion”; the link routed to /auth/?return=/profile/, so after sign-in it returned to Profile rather than opening a deletion request or a useful destination. Profile had no About entry, even though the homepage already describes the marketplace purpose; the existing #grievance destination was also not exposed from Profile.
- **Expected:** a real, discoverable About destination; a truthful account-deletion help destination that does not imply deletion occurs; and a Profile link to the existing grievance section.
- **Actual before fix:** About was not reachable from Profile; Account deletion was a misleading sign-in detour; the grievance fragment existed only elsewhere.
- **Severity:** P1 navigation/trust issue. The actual deletion workflow remains a separate P0 gap and is not implemented by this change.
- **Fix in stacked PR #148:** add a small responsive About page based on existing product-purpose copy; link it from Profile; route “Account deletion help” to the existing Support page with explicit copy that the link does not delete the account; expose the existing grievance fragment; add About route/document to the PWA precache and bump cache revision to doodhwala-v112.
- **Regression coverage:** scripts/test-profile-details-contract.mjs checks Profile destination links, About back navigation, existing legal fragment IDs, and explicit non-deletion disclosure. scripts/test-service-worker.mjs, scripts/test-pwa-offline-contracts.mjs, and the Chromium PWA smoke test check About route/document precaching. The Chromium PWA smoke script is configured to visit Profile and About at 390×844 and capture profile-destinations.png and about-page.png; those screenshots are NOT RUN YET because the stacked PR currently does not trigger workflows filtered to main. Results remain PENDING CI on the stacked PR head until the parent is merged and the branch is retargeted/rebased.

## Verification matrix

| Check | Exact command/environment | Result | Evidence / limitation |
|---|---|---|---|
| Profile source-contract + mocked UI-state regression | `node scripts/test-profile-details-contract.mjs` via Static validation, tested code SHA `105de7299e8936aa7f78798b541216008228a3a4` | PASS | [Static validation run 40897115651](https://github.com/Mahin98250/Doodhwala/actions/runs/40897115651). Includes failed-read → retry-success state simulation; RPC call count is asserted to remain zero. |
| PWA source-contract regression | `node scripts/test-pwa-offline-contracts.mjs` via Static validation, tested code SHA `105de7299e8936aa7f78798b541216008228a3a4` | PASS | [Static validation run 40897115651](https://github.com/Mahin98250/Doodhwala/actions/runs/40897115651). Cache expectations in related contracts were aligned to v111. |
| Site validation / JS syntax | Repository Static validation on code SHA `105de7299e8936aa7f78798b541216008228a3a4` | PASS | [Run 40897115651](https://github.com/Mahin98250/Doodhwala/actions/runs/40897115651).
| Profile read/write persistence | Authenticated customer browser session in an approved non-production test environment | BLOCKED / NOT RUN | Requires an approved test account/session and an explicitly permitted isolated test environment. This sprint does not test or alter RPC/database behavior. |
| Mobile/tablet/desktop visual check | Real browser/device at 320, 390, 768, 1024, and 1440 CSS px | NOT RUN | CI/source contracts are not physical-device or full visual proof. |
| PWA offline/reconnect smoke | Chromium via `.github/workflows/pwa-offline-browser.yml`, viewport 390×844, tested code SHA `105de7299e8936aa7f78798b541216008228a3a4` | PASS | [Run 40897115563](https://github.com/Mahin98250/Doodhwala/actions/runs/40897115563); [screenshots + JSON artifact](https://github.com/Mahin98250/Doodhwala/actions/runs/40897115563/artifacts/12907243012). Covers local cached shell, query route, offline fallback and reconnect. |
| Physical installed-PWA lifecycle | Android/iOS device; fresh install, update from prior cache, old tab open, reconnect refresh | NOT RUN | CI Chromium evidence is not physical-device proof. |

## Additional CI evidence on code SHA `105de7299e8936aa7f78798b541216008228a3a4`

- **PASS — In-app notification UI and migration validation:** [run 40897115562](https://github.com/Mahin98250/Doodhwala/actions/runs/40897115562).
- **PASS — Disposable PostgreSQL validation:** [run 40897115599](https://github.com/Mahin98250/Doodhwala/actions/runs/40897115599). This is CI-only synthetic validation; this task made no database or migration changes and did not connect to a live database.

## Remaining sprint coverage — not claimed complete

- Customer/provider route matrix, all buttons/forms/dialogs, provider forms, cart/checkout-entry UI, accessibility keyboard/screen-reader/contrast/touch-target checks, and rendered overflow checks still require their own evidence.
- DW-002 responsive source/Chromium work is already in [PR #139](https://github.com/Mahin98250/Doodhwala/pull/139); do not duplicate its findings or overwrite its branch.
- DW-003 PWA implementation/audit is already represented by [PR #90](https://github.com/Mahin98250/Doodhwala/pull/90) and [PR #112](https://github.com/Mahin98250/Doodhwala/pull/112), while merged source has advanced beyond those older cache revisions. Reconcile their unique coverage against current main before deciding whether to port or supersede anything.
- Support, notifications, discovery/search, provider cards, cart and checkout need focused follow-up audit/fixes if reproducible gaps remain. No full-app or release-ready claim is made by this slice.
