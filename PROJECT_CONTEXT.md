# Doodhwala — Project Context & Team Handoff

> **Purpose:** This is the durable handoff document for anyone (including AI assistants) continuing work on Doodhwala. Read this before making changes. Update it in the same pull request/commit whenever project direction, implementation status, or important decisions change.

**Last updated:** 2026-10-23  
**Repository:** https://github.com/Mahin98250/Dudh-Wallah  
**Default branch:** `main`  
**Product:** Doodhwala — a local-first marketplace connecting customers with independent neighbourhood milk sellers.

---

## 1. Product in one minute

Doodhwala helps customers discover independent local milk sellers, compare milk types and prices, place orders, and eventually manage recurring milk delivery. Independent sellers manage their profile, service area, products, availability, and orders.

**Core marketplace rule:** This is for independent/local milk sellers, not a catalogue for large packaged-dairy brands. Never present demo listings as real businesses.

**Product principles**
- Make everyday customer and seller tasks quick and dependable.
- Mobile-first, responsive UI; desktop should also feel intentionally designed.
- Be transparent about demo data, verification, order state, payment state, and limitations.
- Protect customer/provider data with server-side authorization and database policies.
- Do not claim legal compliance, licences, provider verification, refunds, or payment success unless actually verified and implemented.

## 2. Current implementation (based on repository README)

The existing codebase is primarily static HTML/CSS/JavaScript, with Supabase integration. Read the actual source and migrations before modifying behavior; this section is a high-level map, not a substitute for code inspection.

### Customer experience
- Explore/discover local providers, search and filters.
- Product selection and cart with quantity controls and LocalStorage persistence.
- Address capture and checkout flow.
- Mobile bottom navigation and desktop navigation.
- PWA manifest and service worker.
- Customer email/password authentication and backend-connected order creation.

### Provider experience
- Provider onboarding at `/provider.html`.
- Profile, locality/service radius, delivery window and product setup.
- Catalogue add/edit/delete/activate/pause, search and stock filtering.
- Provider dashboard and verification centre.
- Provider console can sync with Supabase for authenticated providers.

### Backend foundation
- Supabase schema/RLS for customers, providers, products, service areas, addresses, orders and order items.
- Server-side order creation validates ownership, provider/product availability and stored pricing.
- Location-aware provider discovery.
- Multi-provider carts are split into separate provider orders.
- Setup notes: [SUPABASE_SETUP.md](./SUPABASE_SETUP.md).

### Payments — critical status boundary
The repository contains two distinct payment layers. **Direct seller UPI + COD MVP:** sellers can save their UPI ID/payee name, customers can open a UPI intent/QR from their order, and the seller can manually attest that receipt was checked in their own bank/UPI app. Doodhwala does not hold or settle those funds, and the seller's confirmation is not independently bank-verified. **Doodhwala Pay foundation:** a server-owned payment transaction ledger and Edge Function for idempotent payment-intent creation/status lookup. It is **not a live automated payment gateway**; its documented API state is `gateway_ready: false` and `money_moved: false`. See [DIRECT_UPI_PAYMENT_FLOW.md](./DIRECT_UPI_PAYMENT_FLOW.md).

Do not claim automated gateway verification or independently verified payment success until a real provider/acquirer or supported bank/PSP integration, server-side secrets, verified signed webhooks, replay protection, reconciliation, failure handling, refunds, and required reviews/tests are implemented. For direct UPI, only a seller may attest after checking their own bank/UPI app; label this as seller-confirmed, not bank-verified. Never collect card numbers, CVV, UPI PINs, OTPs, or banking passwords. Never trust a client redirect alone as proof of payment.

### Release verification
The repository README includes a P0 end-to-end checklist for customer checkout → provider order queue → provider status changes → customer tracking. Static builds do not prove real authentication, RLS, Realtime, permissions, location, or physical-device behavior. Use an authorized staging project and test accounts; do not create synthetic orders in production.

## 3. Latest product direction / pending UX work

Recent direction from the project owner:
1. Remove the opening/home section or branding that says **“Doodhwala 10x”**; it does not fit the desired brand.
2. Choose a cleaner, more trustworthy product name/brand treatment. Until the owner approves a final name, use **Doodhwala** as the working product name and do not perform a sweeping rename of repositories, database identifiers, or deployment settings.
3. Keep the feature set focused. Prioritize one genuinely useful everyday workflow for both customers and sellers instead of adding lots of low-value features.
4. Continue UI polish, but preserve working functionality and audit the actual implementation rather than only proposing changes.

**Recommended candidate for the next product discovery task:** a clear daily-delivery control that lets customers see whether their next delivery is scheduled and lets sellers quickly see today's pending/confirmed deliveries. Validate existing order/subscription functionality first; do not build a duplicate system if equivalent functionality already exists. Do not represent subscriptions as production-ready unless the underlying scheduling, order creation, cancellation/skip rules, and seller view are actually implemented and tested.

These items are direction and proposed next work, not claims that changes have already shipped.

## 4. Prioritized roadmap

### P0 — Reliability and release safety
- [ ] Run a repository-wide audit of navigation, buttons/forms, authentication states, checkout, order status and mobile layouts.
- [ ] Verify customer checkout → provider queue → status updates → customer tracking in staging.
- [ ] Test retry/double-submit behavior and ensure it cannot create duplicate orders.
- [ ] Review Supabase RLS and Edge Function authorization against real user roles.
- [ ] Confirm the service worker does not keep stale assets after deployments.
- [ ] Clearly separate demo listings from approved/live providers.

### P1 — Brand and daily usefulness
- [ ] Remove “Doodhwala 10x” from the user-facing entry experience.
- [ ] Keep Doodhwala as the working brand until a replacement is explicitly approved.
- [ ] Identify the smallest high-value daily workflow shared by customers and sellers; inspect existing features before implementation.
- [ ] Improve loading, empty, error, offline and success states so the app always explains what is happening.
- [ ] Keep mobile interactions easy to use with one hand; maintain a polished desktop layout.

### P2 — Payments and operational readiness
- [ ] Keep real money collection disabled until a provider/acquirer is selected and its server-side integration is complete.
- [ ] Implement and test provider-signed webhooks, replay protection, reconciliation, idempotent state changes, cancellations and refunds before launch.
- [ ] Complete legal/privacy/security review with qualified professionals; keep drafts clearly labelled for review.
- [ ] Add observability and safe error reporting without logging secrets or sensitive customer data.

## 5. Repository orientation

Useful starting points currently present in the repository:
- `README.md` — overview, roadmap and staging release checklist.
- `SUPABASE_SETUP.md` — Supabase configuration and setup.
- `SECURITY.md` — security guidance and reporting expectations.
- `app.js` — main customer-side JavaScript.
- `admin.html`, `admin.js`, `admin.css` — admin interface.
- `auth.html`, `auth.js`, `auth.css` — authentication interface.
- `provider.html` and provider-related assets/scripts — seller onboarding and dashboard.
- `checkout-10x.js` — checkout-related logic; inspect its imports/call sites before editing.
- Supabase migrations and `supabase/functions/` — database policies and server-side functions.

File names are a starting map; confirm current paths and dependencies from the checked-out branch before making assumptions.

## 6. How our small team should collaborate

For a team of 2–4 people, avoid multiple people editing the same file on `main` simultaneously.

1. **Start each session:** pull the latest `main`, read this file and `README.md`, inspect recent commits, and check open pull requests/issues.
2. **Agree on ownership:** split work by bounded area (for example: customer UI, provider UI, backend/security, QA/docs). Name an owner for each task.
3. **Use branches:** create a short branch such as `feat/daily-delivery-summary` or `fix/mobile-checkout`. Do not commit directly to `main` for multi-person feature work.
4. **Small pull requests:** one purpose per PR; include screenshots for UI changes, test steps, risks, and any migration/deployment notes.
5. **Review before merge:** another teammate checks behavior, responsive states, security/authorization impact, and regressions.
6. **Never share secrets in chat, commits, screenshots, or this document.** Use each person's authorized account and the project's secret manager.
7. **Coordinate schema changes:** migrations should be additive where possible, reviewed before applying, and tested in staging first.
8. **Update the handoff:** after a meaningful change, update the status table below and record the commit/PR, tests run, known issues, and next step.

Suggested Git routine:
```bash
git switch main
git pull --ff-only
git switch -c feat/short-task-name
# make one bounded change
git diff --check
# run the project’s available checks; document checks that cannot be run
git add <specific-files>
git commit -m "feat: describe the change"
git push -u origin feat/short-task-name
# open a pull request and request review
```

Do not assume a test command exists. Inspect repository configuration first and use the actual scripts/tools available.

## 7. Session handoff / network-loss recovery

When the connection drops or a new person/assistant resumes:
1. Open this file first, then `README.md` and `SUPABASE_SETUP.md` if backend work is involved.
2. Check `git status`, current branch, latest commit, and open PRs. Preserve uncommitted work; do not overwrite another person's changes.
3. Compare this document with the current code. The code and merged commits are the source of truth if this note is stale.
4. Resume the **Next task** below only after checking whether someone has already started or completed it.
5. After making changes, update this file with factual results. Clearly distinguish implemented, tested, deployed, and still unverified.

## 8. Progress log

| Date | Update | Evidence / status |
|---|---|---|
| 2026-10-23 | Created this team handoff and context document. | Commit [`7e3195b`](https://github.com/Mahin98250/Dudh-Wallah/commit/7e3195b75fb3761a56350c7718c2404adf83fb59); documentation only. |
| 2026-10-23 | Inspected the current `index.html` entry page while checking the “Doodhwala 10x” request. | Current `index.html` uses “Doodhwala” branding and contains no “Doodhwala 10x” / “10x” text. No UI change was made based on this check; investigate other routes or the deployed build before removing anything blindly. |
| Previously documented in README | Customer/provider workflows, Supabase foundation, order creation, and Doodhwala Pay foundation described. | Treat runtime and production status as unverified until tested; payment gateway is explicitly not ready for live money movement. |

Add newest entries at the top. Include commit/PR links and test outcomes whenever available. Do not invent commit hashes, deployment status, or test results.

## 9. Current session checkpoint

**Next task:** locate the exact route/component or deployed asset where the user still sees “Doodhwala 10x” (the current `index.html` does not contain that string), then make a targeted change and verify the actual page. Next, audit the daily customer/seller workflow to identify the highest-value small feature. Keep the working brand as Doodhwala until a final name is approved.

**Current verification boundary:** this was a source inspection only. The UI has not been changed, the deployed build was not verified, no new feature has shipped in this session, end-to-end order flow is not verified, and Doodhwala Pay cannot be claimed to collect money.

**Definition of done for the next session:** a small, reviewed change; checks recorded; no secrets committed; this document updated with actual commit/PR and test results.
