# DW-003 PWA cache freshness and honest offline behavior

**Scope:** Service-worker cache freshness, exact customer asset URLs, cache cleanup on the shared GitHub Pages origin, network-response persistence, offline fallback and reconnect messaging.

## Findings and fixes

### PWA-001 — exact asset variants must be precached
Checkout requests `/Doodhwala/customer-journey-refresh.css?v=20261025.1`; an older customer UI polish URL is `/Doodhwala/customer-ui-polish.css?v=20261025.3`; customer pages also request the mascot without a query string. The worker includes those exact URLs alongside newer variants. **Historical snapshot only:** the earlier PR #106 audit recorded cache `doodhwala-v98`. Current main has since advanced; see the 2026-10-29 snapshot below.

### PWA-002 — only Doodhwala cache keys may be removed
Activation now deletes obsolete keys only when they begin with `doodhwala-`. Unrelated Cache Storage entries on the shared `mahin98250.github.io` origin are preserved.

### PWA-003 — network cache writes must finish before the response resolves
The worker now awaits `cache.put(event.request, response.clone())` for successful same-origin GET responses before returning the network response. Cache failures do not block the online response, but the write is no longer fire-and-forget.

### PWA-004 — offline recovery must be part of the core shell
`/Doodhwala/offline.html` is included in `CORE_ASSETS`; failure to cache it therefore prevents the install from being treated as successful. Offline messaging says previously cached pages may remain available and that sign-in, account, order, live-update and payment actions need a connection.

## Automated validation

- `scripts/test-service-worker.mjs` covers obsolete-cache cleanup, unrelated-cache preservation, exact URL precache contracts, required offline core asset, and the awaited query-string cache write.
- `scripts/test-pwa-offline-contracts.mjs` protects cache scope, exact asset variants and customer-facing offline/reconnect copy.
- `.github/workflows/pwa-browser-evidence.yml` runs a local static server with isolated browser storage, captures screenshots and writes JSON results to a downloadable artifact. External requests are blocked; it does not authenticate users, submit orders, or perform payments.

## Manual/device follow-up still required

- Test physical Android and iOS devices and an installed PWA update while an older tab remains open.
- After reconnect, manually refresh and confirm fresh seller/page content appears.
- Browser automation does not establish real authentication, payment or order-submission behavior.
- Vercel preview is not required for this local offline test and remains subject to the existing free-tier deployment rate limit.

## Safety

No production deployment, production configuration changes, migrations, secrets, real payments, or paid services are used by these checks.


## Current-main snapshot — 2026-10-29

- **Observed main commit:** `dba11d39ae149d0b57fb36003da7d9330aba8b0b` (commit created 2026-10-29).
- **Current service-worker cache:** `doodhwala-v110`.
- **Current milk-transition asset query version:** `20261027.8` in `product.html` and the worker asset list. The product-runtime contract now expects cache v110 and transition assets `.8`; the previously observed PR #113 head `b50580b` had stale v101 / `.6` expectations, but PR #113 was later merged on head `a1af2ff92794310792ce92f170b7c4aecbf78f9b` after all four GitHub Actions workflows passed.
- **Merged implementation baseline:** PR [#106](https://github.com/Mahin98250/Doodhwala/pull/106) contains the cache-scope and persistence changes. The older draft [#90](https://github.com/Mahin98250/Doodhwala/pull/90) uses stale v95 expectations and is 33 commits ahead / 20 behind current main; do not merge it as-is. The documentation-only [#112](https://github.com/Mahin98250/Doodhwala/pull/112) is an earlier audit update and should not be treated as current-main version evidence.
- **PASS (historical PR #90 head only):** [Static run 40371393861](https://github.com/Mahin98250/Doodhwala/actions/runs/40371393861), [SQL run 40371393852](https://github.com/Mahin98250/Doodhwala/actions/runs/40371393852), [PWA browser run 40371394649](https://github.com/Mahin98250/Doodhwala/actions/runs/40371394649). These do not validate the current main SHA.
- **Current main combined status observed:** Vercel success at [preview status](https://vercel.com/patelmahin140-4489s-projects/doodhwala-next-preview/A8QYVTUAejaoj9J2f1D4RfaudZSM). Current-main push-triggered GitHub Actions run IDs were not available through the evidence lookup used for this report; no current-main Actions pass is inferred from Vercel.
- **BLOCKED / NOT RUN:** Installed PWA update while an older tab remains open, physical Android/iOS offline/reconnect, and authenticated order/payment behavior. Existing Chromium tests are isolated and do not test real accounts or transactions.

## Release gate

PWA source contracts and the historical Chromium smoke are useful scoped evidence; they do not prove physical-device update behavior or authenticated production journeys. No production test writes, deployments, or real payments were performed as part of this audit.
