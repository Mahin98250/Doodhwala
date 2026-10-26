# DW-002 — UI/UX audit findings

**Date:** 2026-10-26  
**Scope:** Public customer-facing Doodhwala UI, source inspection of `index.html`, `styles.css`, `app.js`, and `customer-nav.js`.  
**Environment limitation:** This pass used repository source inspection. A real interactive browser/device session was not available, so runtime behavior, screenshots, and end-to-end form submissions are not claimed as verified.

## Finding UX-001 — Mobile bottom-navigation labels are too small

- **Severity:** Medium (usability/accessibility)
- **Route:** `/Doodhwala/` and customer routes that load `customer-nav.js`
- **Viewport/device:** Small mobile viewport (≤360 CSS px), especially Android phones
- **Steps:** Open the site on a small mobile viewport; inspect the fixed six-item bottom navigation.
- **Expected:** Navigation labels should remain comfortably readable and distinguishable without zooming.
- **Actual (source-confirmed):** Labels were styled at 7.5px, reduced to 7px at widths ≤360px. This is unusually small for primary navigation and can impair readability.
- **Change in this branch:** Increase labels to 9px (8.5px at ≤360px) and use a slightly more readable line-height.
- **Verification:** Source diff inspected; real-device visual check still required.

## Audit checklist and follow-up verification

The following are test cases to execute in a browser; they are not represented as passed without runtime evidence.

| Area | Route / viewport | Steps | Expected behavior | Severity if failing | Status |
|---|---|---|---|---|---|
| Primary navigation | `/`, desktop ≥1024px | Activate Home, Providers, Plans, Orders, Saved | Correct section/route opens; active state follows destination | High | Needs browser verification |
| Bottom navigation | `/`, mobile 320–390px | Tap all six items; repeat with cart empty and populated | Targets are tappable, labels readable, active state and cart badge update | Medium | Label-size fix in branch; device verification pending |
| Search and filters | `/`, mobile + desktop | Search known provider, then unmatched query; switch milk filters and sort | Results match query/filter; no-results state is clear and recoverable | High | Needs browser verification |
| Location selection | `/`, mobile + desktop | Open location picker; deny location permission; try manual location selection | Permission denial is explained; user can recover without a dead end | High | Needs browser verification |
| Cart and checkout | `/checkout.html`, mobile + desktop | Open empty cart, add item, change quantity, submit invalid/incomplete checkout | Empty state is actionable; totals update; validation errors are clear | Critical if order/payment can be incorrect | Needs browser verification |
| Authentication | `/auth.html`, mobile + desktop | Submit blank/invalid values; test sign-in and sign-up paths | Inline validation and recoverable errors; no silent failure | High | Needs browser verification |
| Provider form | `/provider.html`, mobile + desktop | Move through each setup step; omit required fields; submit valid values | Required fields are identified and step progression is predictable | High | Needs browser verification |
| Loading/error states | `/`, slow/offline network | Load providers with network delayed, unavailable, and empty | Loading resolves to data, empty state, or actionable error; never spins indefinitely | High | Needs browser verification |
| Layout/overflow | `/`, 320px, 360px, 768px, 1024px, 1440px | Check header, cards, dialogs, comparison dock and bottom nav | No horizontal page overflow; content is not obscured by fixed controls | Medium | Needs browser verification |
| Keyboard/accessibility | `/` and `/auth.html`, desktop | Tab through controls; activate with keyboard; inspect focus and labels | Visible focus, semantic controls, understandable accessible names | Medium | Needs browser verification |

## Screenshots

No screenshots are attached in this source-only pass because no browser viewport was available to capture trustworthy before/after images. Capture before/after screenshots at 320px and 390px widths when validating the navigation-label change.

## Release note

Do not merge or deploy until the branch has been reviewed and the browser/device checks above have been run. Any Critical/High runtime failures found during execution should be fixed here or filed as follow-up issues with the same reproduction details.


## Customer journey interaction audit

See [`CUSTOMER_JOURNEY_INTERACTION_AUDIT.md`](CUSTOMER_JOURNEY_INTERACTION_AUDIT.md) for source-confirmed expected/actual findings, reproducible test steps, the search accessible-name fix, source-contract coverage, and the explicit browser/device matrix. Runtime tests and screenshots remain pending because no interactive browser was available; none are reported as passed.
