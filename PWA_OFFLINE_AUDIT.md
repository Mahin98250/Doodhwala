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

### PWA-003 — network response caching was fire-and-forget
- **Severity:** Medium (recently visited query-string routes may not be persisted before the worker is terminated).
- **Route:** Any same-origin GET, reproduced in Chromium with `/Doodhwala/orders.html?filter=active`.
- **Steps:** Load a query-string route online, wait for the navigation response, then inspect Cache Storage or switch offline and revisit the same URL.
- **Expected:** A successful network response is cached reliably enough for a later offline exact-request lookup.
- **Actual (browser test before fix):** The exact query-string request was not present in the active cache when the smoke test checked it.
- **Fix:** Attach the cache-write promise to the fetch event with `event.waitUntil(cacheUpdate)`, rather than starting an untracked `cache.put()` promise. The unit-test harness now models and awaits the event lifetime promise.

## Verified from source

- Installation awaits core assets and tolerates individual optional asset failures.
- The offline fallback page is now a required core asset; navigation fallback tries the requested URL, then the dedicated offline page, then the home page.
- The worker uses network-first for same-origin GET requests, caches successful responses, and falls back to exact URL then query-free path. Versioned URLs therefore must be precached exactly when they need to work offline.
- The worker calls `skipWaiting()` and `clients.claim()`; this promotes an installed worker promptly, but does not guarantee the already-rendered document reloads itself. The reconnect banner correctly advises the customer to refresh if content may be stale.
- Offline copy states that only previously cached pages may remain available and explicitly says sign-in, orders, live updates and payments require a connection. The connection banner does not promise offline checkout or order submission.

## Validation status / limits

- Added source-contract regression checks in `scripts/test-pwa-offline-contracts.mjs` and a Chromium browser workflow in `scripts/test-pwa-browser-smoke.mjs` / `.github/workflows/pwa-browser-evidence.yml`.
- The Chromium test seeds a v94 cache and an unrelated origin cache, verifies activation removes only the old Doodhwala cache, checks the exact versioned CSS URL, loads a query-string route before disconnecting, tests cached offline navigation and the dedicated fallback page, then reconnects. An initial run caught the query-route cache-write timing issue above ([failed run](https://github.com/Mahin98250/Doodhwala/actions/runs/40365897322)); the worker and test harness have since been fixed and the latest checks are rerunning. Do not mark the browser suite passed until a current run completes successfully.
- Manual testing is still required for an already-open tab during service-worker update, physical Android/iOS behavior, and the full customer route matrix before merge.
- Suggested browser matrix: 320px and 390px mobile widths plus desktop; clear site data, load each customer route online once, go offline, reload each route, test query-string navigation, restore connection, and verify the reconnect message and fresh content after manual refresh.
