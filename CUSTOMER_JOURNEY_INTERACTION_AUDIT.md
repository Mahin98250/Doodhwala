# DW-002 customer journey interaction audit

**Date:** 2026-10-26
**Branch:** `vaidik/dw-002-ui-ux-audit`
**Scope:** Customer discovery, product detail, cart entry, authentication, location permission, checkout entry, accessibility and failure states.
**Evidence type:** Source inspection of the current branch plus automated source-contract checks. No interactive browser/device runtime was available in this session. **No browser interactions, screenshots, real authentication, or order submissions are claimed as passed.**

## Findings and reproducible checks

| ID / area | Route and source evidence | Reproduction steps (test/demo only) | Expected | Actual evidence / status | Severity |
|---|---|---|---|---|---|
| UX-002 — Search accessible name | `/Doodhwala/`; `index.html#search` | Before fix, inspect the search input's accessible name in browser accessibility tree; after fix, repeat and tab to it. | Search has a programmatic name that does not depend on placeholder-only support. | Source review found a placeholder-only input. Branch adds `aria-label="Search milk, provider or area"`; regression contract checks it. **Browser verification pending.** | Medium |
| Journey-001 — Search/filter/sort | `/Doodhwala/`; `app.js` (`filtered()`, search input, `providerSort`, `render()`) | Enter a matching provider/area; enter an unmatched term; select each milk filter; change sort. | Results update; filters/sort stay usable; unmatched queries show a recoverable no-results state. | Source contains search input handler, filter/sort wiring, no-results rendering, loading/error states and a retry path. **Runtime results not verified.** | High if results are incorrect |
| Journey-002 — Product details | `/Doodhwala/product.html?provider=<demo-id>&product=<demo-id>`; `product.js` | Use approved demo identifiers; open valid and invalid/missing identifiers; change quantity; try add-to-cart only with demo data. | Valid item renders; unavailable item explains the issue and disables add-to-cart; cart changes persist and update the badge. | Source reads both URL IDs, has a not-ready/unavailable state, cart persistence and a cart-updated event. **No live product records or browser interaction tested.** | High if wrong item/price is added |
| Journey-003 — Cart quantity and empty state | `/Doodhwala/` cart panel and `/Doodhwala/checkout.html`; `app.js`, `checkout.js` | With local demo cart data, test empty cart, increment/decrement quantity, remove last item, reload. | Quantities and totals stay consistent; empty state is clear; reload preserves local cart. | Source initializes cart from local storage and checkout has a duplicate-submit guard/idempotency storage contract. Exact visual quantity behavior and totals remain **browser verification pending**. | Critical if totals/order contents diverge |
| Journey-004 — Sign-in/sign-up validation | `/Doodhwala/auth.html`; `auth.html`, `auth.js` | Submit empty form; use invalid email and a password shorter than eight characters; switch sign-in/create-account mode. Do not use a real account unless explicitly authorized. | Native validation prevents malformed submission; mode labels/fields match the selected action; backend errors are visible and recoverable. | Email is required/type=email; password is required/type=password/minlength=8; source includes user-facing auth messages. **No authentication request was submitted.** | High |
| Journey-005 — Location permission/recovery | `/Doodhwala/`; `location.js` | Open location picker, deny browser geolocation, then try manual map/location selection and close/reopen. | Denial is explained; customer can close/retry or select a location manually; UI does not get stuck loading. | Source has explicit geolocation denial/error messages and map/location UI. Manual fallback and focus handling need **browser verification**. | High if location cannot be recovered |
| Journey-006 — Checkout entry and safety | `/Doodhwala/checkout.html`; `checkout.html`, `checkout.js` | Open checkout signed out; inspect required address fields; use test/demo data only and stop before the final order action. | Signed-out users see a sign-in gate; required fields validate; unconfigured backend does not imply a successful order. | Source exposes an auth gate, required address fields, explicit unconfigured-backend messaging, duplicate-submit guard and idempotency key storage. **No order was placed or submitted.** | Critical |
| Journey-007 — Offline/reconnect messaging | Customer pages; `network-status.js`, `offline.html` | With DevTools/airplane mode, toggle network off/on and inspect banner and navigation fallback. | UI says only cached pages may remain available; checkout/account/order actions are not promised offline; reconnect suggests refresh. | Copy and source-contract checks exist in DW-003 / PR #90. **Real offline browser test is pending there.** | High |
| UX-003 — Keyboard/focus and responsive layout | Home, auth, product, checkout; `customer-nav.js`, page styles | At 320, 360, 390, 768, 1024 and 1440 CSS px, tab through controls, activate buttons with keyboard, inspect focus and horizontal overflow. | Visible focus, named controls, usable touch targets, no clipped content/overflow. | Native button semantics and navigation aria labels are present; search label was added. **No full keyboard, touch-target, screen-reader or viewport check was run.** | Medium; High for blocked critical flows |

## Automated source-contract coverage

The branch adds `scripts/test-ui-regression-contracts.mjs` and a focused `.github/workflows/ui-regression-contracts.yml` workflow so UI checks remain isolated from the DW-003 service-worker workflow. It protects shared navigation destinations/active state/cart badge, the search accessible name and input wiring, sort/filter/error/retry contracts, product/cart wiring, geolocation denial messaging, and checkout/auth safety contracts.

These tests are **source-level assertions**, not browser automation. They can catch accidental source regressions but cannot prove layout, focus order, real network behavior, valid data rendering, authentication, or checkout behavior.

## Browser/device matrix — pending, not passed

| Scenario | Browser/device | Viewport | Result |
|---|---|---:|---|
| Bottom nav readability/taps | Android Chrome (device or responsive emulation) | 320 × 800 | Not run — no interactive browser available |
| Bottom nav readability/taps | Android Chrome (device or responsive emulation) | 390 × 844 | Not run — no interactive browser available |
| Tablet layout/navigation | Chromium responsive emulation | 768 × 1024 | Not run — no interactive browser available |
| Desktop navigation/keyboard | Chromium or Firefox desktop | 1024 × 768 and 1440 × 900 | Not run — no interactive browser available |
| Search, filters, sort, empty/error | Desktop + mobile | 390 × 844 and 1440 × 900 | Not run — no interactive browser available |
| Product/cart quantity and totals | Desktop + mobile, demo data only | 390 × 844 and 1440 × 900 | Not run — no interactive browser available |
| Auth validation and location denial | Desktop + mobile, no real account | 390 × 844 and 1440 × 900 | Not run — no interactive browser available |
| Checkout entry | Desktop + mobile; stop before submit | 390 × 844 and 1440 × 900 | Not run — no order submitted |
| Offline/reconnect and service-worker update | Desktop + mobile DevTools | 390 × 844 and 1440 × 900 | Not run here; tracked in DW-003 / PR #90 |

## Safety and handoff

- Use demo/test data only. Do not place real orders or inspect customer data.
- No production configuration, migrations, deployment or paid services were changed.
- No screenshots are attached because no real browser viewport was available; do not substitute source screenshots or generated mockups for browser evidence.
- Complete the matrix above and attach actual browser screenshots before marking runtime acceptance complete.
