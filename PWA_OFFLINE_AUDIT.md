# DW-003 PWA cache freshness and honest offline behavior

**Scope:** Service-worker cache freshness, exact customer asset URLs, cache cleanup on the shared GitHub Pages origin, network-response persistence, offline fallback and reconnect messaging.

## Findings and fixes

### PWA-001 — exact asset variants must be precached
Checkout requests `/Doodhwala/customer-journey-refresh.css?v=20261025.1`; an older customer UI polish URL is `/Doodhwala/customer-ui-polish.css?v=20261025.3`; customer pages also request the mascot without a query string. The worker includes those exact URLs alongside newer variants. At the current-main audit snapshot `dba11d39ae149d0b57fb36003da7d9330aba8b0b` (2026-10-29), the worker cache name is `doodhwala-v110`. The focused profile retry PR #147 may advance this to v111; re-check the cache version against the merged/current source before accepting this document.

### PWA-002 — only Doodhwala cache keys may be removed
Activation deletes obsolete keys only when they begin with `doodhwala-`. Unrelated Cache Storage entries on the shared `mahin98250.github.io` origin are preserved.

### PWA-003 — network cache writes must finish before the response resolves
The worker awaits `cache.put(event.request, response.clone())` for successful same-origin GET responses before returning the network response. Cache failures do not block the online response, but the write is no longer fire-and-forget.

### PWA-004 — offline recovery must be part of the core shell
`/Doodhwala/offline.html` is included in `CORE_ASSETS`; failure to cache it therefore prevents the install from being treated as successful. Offline messaging says previously cached pages may remain available and that sign-in, account, order, live-update and payment actions need a connection.

## Current-main evidence snapshot — 2026-10-29

Audited source commit: `dba11d39ae149d0b57fb36003da7d9330aba8b0b`.

- **PASS — Static validation:** [run 40831023494](https://github.com/Mahin98250/Doodhwala/actions/runs/40831023494).
- **PASS — PWA offline browser evidence:** [run 40831023513](https://github.com/Mahin98250/Doodhwala/actions/runs/40831023513).
- **PASS — SQL migration validation:** [run 40831023661](https://github.com/Mahin98250/Doodhwala/actions/runs/40831023661). This is disposable CI validation only; no migration was applied to a live project.
- **PASS — In-app notification validation:** [run 40831023503](https://github.com/Mahin98250/Doodhwala/actions/runs/40831023503).
- **PASS — GitHub Pages build/deployment workflow:** [run 40831023228](https://github.com/Mahin98250/Doodhwala/actions/runs/40831023228).
- **PASS — Scheduled live-page smoke:** [run 40861856162](https://github.com/Mahin98250/Doodhwala/actions/runs/40861856162).

These results are for the exact listed main SHA and do not prove a fresh install on a physical phone, an update while an older tab remains open, or account/order behavior while offline. The PR is a documentation reconciliation, not a deployment or a claim that manual device acceptance is complete.

## Automated validation

- `scripts/test-service-worker.mjs` covers obsolete-cache cleanup, unrelated-cache preservation, exact URL precache contracts, required offline core asset, and the awaited query-string cache write.
- `scripts/test-pwa-offline-contracts.mjs` protects cache scope, exact asset variants and customer-facing offline/reconnect copy.
- `.github/workflows/pwa-offline-browser.yml` runs a local static server with isolated browser storage, captures screenshots and writes JSON results to a downloadable artifact. External requests are blocked; it does not authenticate users, submit orders, or perform payments.

## Manual/device follow-up still required

- Test physical Android and iOS devices and an installed PWA update while an older tab remains open.
- After reconnect, manually refresh and confirm fresh seller/page content appears.
- Browser automation does not establish real authentication, payment or order-submission behavior.
- Vercel preview is not required for this local offline test and remains subject to the existing free-tier deployment rate limit.

## Safety

No production deployment, production configuration changes, migrations, secrets, real payments, or paid services are used by these checks.
