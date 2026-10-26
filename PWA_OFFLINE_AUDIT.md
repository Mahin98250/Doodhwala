# DW-003 PWA and offline audit

**Branch:** `vaidik/dw-003-pwa-offline-audit`  
**Scope:** service-worker install/activation/cache versioning/navigation fallback/update behavior and customer-facing offline/reconnect messaging. This audit is separate from DW-002 / PR #88.

## Findings

### PWA-001 — current page assets were not all precached under the exact request URL
- **Severity:** Medium (offline visual regression; online fetch-first path usually masks it).
- **Routes:** `/Doodhwala/checkout.html`, `/Doodhwala/plans.html`, `/Doodhwala/orders.html`; shared mascot image on customer pages.
- **Viewport/device:** Source-level finding; affects mobile and desktop. A real browser/device reproduction is still pending.
- **Steps to reproduce:** With a clean browser profile, load the site online so the service worker installs, then disconnect and open Checkout. Compare requested asset URLs in the HTML with the URLs seeded into the worker cache. Checkout requests `customer-journey-refresh.css?v=20261025.1`, while the precache only listed the `.3` variant. Plans and Orders request `customer-ui-polish.css?v=20261025.3`, while the precache listed only `.1`. Pages also request `/Doodhwala/assets/mascot.png` without a query, while the cache list had only a versioned mascot URL.
- **Expected:** The exact same-origin asset URLs used by the customer pages are available offline.
- **Actual (from source):** Those URL variants are not guaranteed to exist in Cache Storage after installation; offline requests can fail and render pages without those styles/images.
- **Smallest safe fix:** Add the exact current URLs to the precache and bump the cache name to `doodhwala-v95`, causing a fresh install instead of reusing the v94 cache.

### PWA-002 — activation removed every other origin cache
- **Severity:** Medium (cross-app side effect on the shared `mahin98250.github.io` origin).
- **Steps:** Inspect the old activation handler: it deleted every cache key other than the Doodhwala cache.
- **Expected:** Activation removes only obsolete Doodhwala caches.
- **Actual (before fix):** Unrelated Cache Storage entries on the same origin could be deleted.
- **Fix:** Delete only keys with the `doodhwala-` prefix, retaining unrelated app caches.

## Verified from source

- Installation awaits core assets and tolerates individual optional asset failures.
- The offline fallback page is now a required core asset; navigation fallback tries the requested URL, then the dedicated offline page, then the home page.
- The worker uses network-first for same-origin GET requests, caches successful responses, and falls back to exact URL then query-free path. Versioned URLs therefore must be precached exactly when they need to work offline.
- The worker calls `skipWaiting()` and `clients.claim()`; this promotes an installed worker promptly, but does not guarantee the already-rendered document reloads itself. The reconnect banner correctly advises the customer to refresh if content may be stale.
- Offline copy states that only previously cached pages may remain available and explicitly says sign-in, orders, live updates and payments require a connection. The connection banner does not promise offline checkout or order submission.

## Validation status / limits

- Added source-contract regression checks in `scripts/test-pwa-offline-contracts.mjs`.
- This is a source audit, not a browser simulation. A real offline/reconnect test with DevTools or airplane mode, including an already-open tab during service-worker update, remains required before merge.
- Suggested browser matrix: 320px and 390px mobile widths plus desktop; clear site data, load each customer route online once, go offline, reload each route, test query-string navigation, restore connection, and verify the reconnect message and fresh content after manual refresh.
