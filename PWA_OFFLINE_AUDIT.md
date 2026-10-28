# DW-003 PWA cache freshness and honest offline behavior

**Scope:** Service-worker cache freshness, exact customer asset URLs, cache cleanup on the shared GitHub Pages origin, network-response persistence, offline fallback and reconnect messaging.

## Findings and fixes

### PWA-001 — exact asset variants must be precached
Checkout requests `/Doodhwala/customer-journey-refresh.css?v=20261025.1`; an older customer UI polish URL is `/Doodhwala/customer-ui-polish.css?v=20261025.3`; customer pages also request the mascot without a query string. The worker now includes those exact URLs alongside newer variants. The current cache name on main at the 2026-10-28 review is `doodhwala-v105`; the current `sw.js` blob is `0037577e51a9bf6ffb29bd5b83128e54f23a4c82`. Cache-version references in this audit should be refreshed whenever the service-worker revision advances.

### PWA-002 — only Doodhwala cache keys may be removed
Activation now deletes obsolete keys only when they begin with `doodhwala-`. Unrelated Cache Storage entries on the shared `mahin98250.github.io` origin are preserved.

### PWA-003 — network cache writes must finish before the response resolves
The worker now awaits `cache.put(event.request, response.clone())` for successful same-origin GET responses before returning the network response. Cache failures do not block the online response, but the write is no longer fire-and-forget.

### PWA-004 — offline recovery must be part of the core shell
`/Doodhwala/offline.html` is included in `CORE_ASSETS`; failure to cache it therefore prevents the install from being treated as successful. Offline messaging says previously cached pages may remain available and that sign-in, account, order, live-update and payment actions need a connection.

## Automated validation

- `scripts/test-service-worker.mjs` covers obsolete-cache cleanup, unrelated-cache preservation, exact URL precache contracts, required offline core asset, and the awaited query-string cache write.
- `scripts/test-pwa-offline-contracts.mjs` protects cache scope, exact asset variants and customer-facing offline/reconnect copy.
- `.github/workflows/pwa-offline-browser.yml` runs a local static server with isolated browser storage, captures screenshots and writes JSON results to a downloadable artifact. This is the workflow path present on current main; the older PR #90 path `.github/workflows/pwa-browser-evidence.yml` is not present on main. External requests are blocked; it does not authenticate users, submit orders, or perform payments.

## Evidence snapshot — 2026-10-28

- Current main SHA reviewed: `ad49f2c32ad49d396b9d7abf0719f9cbf4a392ad`.
- Current service-worker cache: `doodhwala-v105`; milk-transition CSS/JS query version: `20261027.8`.
- PR #113 merged head `a1af2ff92794310792ce92f170b7c4aecbf78f9b`: **PASS** static [run 40614198562](https://github.com/Mahin98250/Doodhwala/actions/runs/40614198562), Chromium PWA [run 40614198400](https://github.com/Mahin98250/Doodhwala/actions/runs/40614198400), SQL [run 40614198410](https://github.com/Mahin98250/Doodhwala/actions/runs/40614198410), notifications [run 40614198412](https://github.com/Mahin98250/Doodhwala/actions/runs/40614198412).
- PR #117 head `57e3b4d179f6e4eec1f3993be371bb636cdea7c2): **PASS** static [run 40663395330](https://github.com/Mahin98250/Doodhwala/actions/runs/40663395330), notifications [run 40663395343](https://github.com/Mahin98250/Doodhwala/actions/runs/40663395343), SQL [run 40663395326](https://github.com/Mahin98250/Doodhwala/actions/runs/40663395326). PR #117 added a contract assertion for the homepage refresh stylesheet; it does not prove full route-to-manifest consistency.
- PR #90 remains open/draft with stale v95 expectations and a duplicate older workflow filename. The service-worker browser smoke, source-contract tests and service-worker test files are present on main with newer contracts. Do not merge #90 as-is; inspect/port only any genuinely unique test behavior.
- Physical Android/iOS, installed-PWA update with an older tab open, and manual freshness after reconnect remain **NOT RUN / BLOCKED**. Browser automation uses isolated local browser storage and is not authenticated E2E evidence.
- GitHub Pages deployment evidence must be recorded separately from Vercel preview status; a passing browser workflow does not prove a current production deployment.

## Manual/device follow-up still required

- Test physical Android and iOS devices and an installed PWA update while an older tab remains open.
- After reconnect, manually refresh and confirm fresh seller/page content appears.
- Browser automation does not establish real authentication, payment or order-submission behavior.
- Vercel preview is not required for this local offline test and remains subject to the existing free-tier deployment rate limit.

## Safety

No production deployment, production configuration changes, migrations, secrets, real payments, or paid services are used by these checks.
