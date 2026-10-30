# Doodhwala Customer App 10X Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a consistent, premium and accessible customer app experience across every customer route without changing marketplace business logic.

**Architecture:** Keep the current multi-page HTML/CSS/vanilla-JavaScript architecture. Add namespaced design tokens while preserving legacy CSS variables, then evolve the shared UI system and page-specific styles in small tested slices. Keep runtime hooks, route paths, script order, data sources and existing navigation behaviour unchanged.

**Tech Stack:** HTML, CSS, vanilla JavaScript, Node.js built-in assertions, existing GitHub Actions and existing browser/PWA checks.

**Spec:** `docs/superpowers/specs/2026-10-30-customer-app-10x-redesign-design.md`

## Global Constraints
- Preserve the current HTML, CSS and vanilla JavaScript architecture.
- Do not add a framework, paid API, dependency, or infrastructure for visual changes alone.
- Preserve all existing customer functionality, runtime hooks, routes, real marketplace data and script load order.
- Retain the seven customer destinations: Home, Explore, Plans, Orders, Saved, Cart and Profile.
- Preserve all legacy CSS variables and selectors until a route-by-route migration is verified.
- No payment gateway, payment collection, checkout business-logic or real-transaction changes.
- No Supabase schema, migrations, RPC, RLS, auth policy, order lifecycle or seller business-rule changes.
- No provider/admin dashboard redesign in this phase.
- Do not merge or modify existing open PRs; work only on `feature/customer-app-10x-redesign`.
- Do not deploy to production or alter production data; no merge without explicit approval.

## Review Focus
- **Narrow viewports (320px, 360px, 390px):** no horizontal page overflow, clipped controls or content hidden behind bottom navigation; test shared shell and each touched page.
- **Long/absent marketplace data:** provider names, prices and metadata wrap safely; missing optional data remains honestly absent rather than receiving invented values; test relevant discovery/store cards.
- **Guest and signed-in sessions:** account identity and sign-in states remain correct; visual changes must not change session logic; pin existing profile/auth hooks.
- **Keyboard and reduced-motion users:** all interactive controls retain visible focus and animations respect `prefers-reduced-motion`; pin shared UI contracts.
- **Offline, loading and empty states:** shared styling must not hide existing status messages or PWA/offline affordances; test existing status/empty hooks.

---

## File Structure

- `styles.css` — existing global variables and base styles; add namespaced tokens without changing legacy computed values.
- `doodhwala-ui-system.css` — shared customer-facing surfaces, controls, focus, responsive safety and motion refinements.
- `customer-nav.js` — existing seven-destination navigation runtime; inspect and preserve behaviour; modify only if a visual accessibility defect cannot be solved in CSS.
- `customer-journey-refresh.css` — customer store, product, plans, orders and checkout presentation.
- `customer-ui-polish.css` — home/plans/orders customer presentation; avoid adding conflicting or duplicated overrides.
- `profile/index.html` — profile markup and currently co-located profile styling; scope any changes to profile classes.
- `notifications.css`, `support.css`, `legal.html` — account-support surfaces; edit only as needed for coherent shared styling.
- `scripts/test-customer-app-design-tokens.mjs` — new test for token presence, alias compatibility and required semantic groups.
- `scripts/test-customer-app-ui-contract.mjs` — new test for navigation destinations, accessibility, responsive and reduced-motion safeguards on the shared UI system.
- `.github/workflows/static-validation.yml` — run the two focused contract tests in the existing static-validation workflow.
- `docs/superpowers/specs/2026-10-30-customer-app-10x-redesign-design.md` — approved design specification.
- `docs/superpowers/plans/2026-10-30-customer-app-10x-redesign.md` — this implementation plan.

No backend, payment, database, auth policy, seller, admin or production configuration files are in scope.

---

### Task 1: Add compatible shared design tokens

**Files:**
- Modify: `styles.css`
- Create: `scripts/test-customer-app-design-tokens.mjs`

**Interfaces:**
- Consumes: existing `:root` legacy variables (`--bg`, `--surface`, `--ink`, `--muted`, `--line`, `--green`, `--green-dark`, `--green-soft`, `--shadow-sm`, `--shadow`, `--shadow-lg`, `--radius-sm`, `--radius`, `--radius-lg`).
- Produces: documented `--dw-*` tokens for brand/semantic colours, surfaces, text, borders, typography, spacing, radius, elevation, motion and z-index. Legacy aliases keep their current computed values.

- [ ] Write the token contract test asserting all semantic token groups and exact preservation of legacy radius values `10px`, `15px`, and `21px`, plus current legacy colour/shadow mappings.
- [ ] Run `node scripts/test-customer-app-design-tokens.mjs`; confirm it fails before implementation.
- [ ] Add the namespaced tokens in `styles.css :root`; keep existing legacy variables and computed values unchanged. Define breakpoints as documentation tokens only, never as CSS media-query variables.
- [ ] Run the focused token test and existing static validation; confirm both pass.
- [ ] Commit the token foundation and test.

### Task 2: Strengthen the shared customer UI system

**Files:**
- Modify: `doodhwala-ui-system.css`
- Create: `scripts/test-customer-app-ui-contract.mjs`

**Interfaces:**
- Consumes: Task 1 `--dw-*` tokens and existing route body classes.
- Produces: predictable shared styling for surfaces, type hierarchy, form controls, buttons, focus, safe-area handling, responsive overflow protection and reduced motion.

- [ ] Add contract assertions for focus-visible, reduced-motion, safe-area-aware layout, disabled controls, route scope and no broad selectors that unintentionally target provider/admin pages.
- [ ] Run `node scripts/test-customer-app-ui-contract.mjs`; confirm the new assertions fail before implementation.
- [ ] Implement shared, presentation-only rules using existing body classes and namespaced tokens; do not change display semantics of hidden/status elements.
- [ ] Run both customer UI contract tests and existing `scripts/test-ui-system-polish.mjs`.
- [ ] Commit shared UI foundation.

### Task 3: Unify the customer navigation and app shell

**Files:**
- Inspect: `customer-nav.js`, `index.html`, customer route HTML files.
- Modify only if required: `customer-nav.js`, `doodhwala-ui-system.css`, page-scoped CSS.

**Interfaces:**
- Consumes: existing navigation keys and route behaviour for home, explore, plans, orders, saved, cart and profile.
- Produces: one coherent mobile/desktop navigation presentation with clear active state, accessible names and cart count, without changing navigation destinations.

- [ ] Extend the UI contract test to assert all seven navigation keys and accessible current-page state.
- [ ] Run the test and inspect the current navigation injection and routing implementation.
- [ ] Apply CSS-first navigation improvements; touch `customer-nav.js` only for a verified accessibility/runtime defect.
- [ ] Run customer navigation, route and PWA contract tests.
- [ ] Commit the shared app-shell update.

### Task 4: Upgrade shopping and discovery screens

**Files:**
- Modify as required: `index.html`, `marketplace-refresh.css`, `customer-ui-polish.css`, `store/index.html`, `product/index.html`, `market.css`, `customer-journey-refresh.css`.
- Tests: existing homepage/marketplace/store/product source-contract tests; add narrowly scoped assertions where a missing test is found.

**Interfaces:**
- Consumes: existing provider search, category filters, sorting, serviceability, favourites, compare, product catalogue and cart hooks.
- Produces: consistent header, discovery hierarchy, provider cards, store catalogue and product detail visuals with truthful optional data.

- [ ] Inventory and pin existing IDs, data attributes, and rendering hooks before markup edits.
- [ ] Add failing tests for any new visual contract that can be checked at source level (one H1, accessible section names, no fabricated card values, responsive/reduced-motion safeguards).
- [ ] Implement scoped HTML/CSS changes while preserving all existing interaction hooks and script order.
- [ ] Run relevant source tests and static validation; manually inspect preview at mobile/tablet/desktop widths.
- [ ] Commit shopping/discovery slice.

### Task 5: Upgrade plans, orders and checkout presentation

**Files:**
- Modify as required: `plans.css`, `orders.css`, `checkout.css`, `customer-journey-refresh.css`, corresponding route HTML only where needed.
- Tests: existing plans/orders/checkout and PWA contracts.

**Interfaces:**
- Consumes: existing form IDs, subscription schedule controls, order status rendering, address forms, cart totals and existing payment selection UI.
- Produces: coherent visual hierarchy and clearer progress/status presentation without changing plan/order/checkout semantics or payment logic.

- [ ] Pin existing form IDs, payment choice values, order action hooks and schedule preview hooks before visual changes.
- [ ] Add focused source assertions for retained IDs and accessible status feedback.
- [ ] Update page-scoped visual styles only; do not edit payment JavaScript, order lifecycle, backend or SQL.
- [ ] Run existing plans/orders/checkout tests and full static validation.
- [ ] Commit transaction-journey visual slice.

### Task 6: Upgrade Profile, notifications, support and legal surfaces

**Files:**
- Modify as required: `profile/index.html`, `profile-details.js`, `notifications.css`, `notifications.html`, `support.css`, `support.html`, `legal.html`.
- Tests: existing profile/session/notification/support/legal contracts; add tests for uncovered route/link invariants.

**Interfaces:**
- Consumes: existing account/session state, profile actions, notifications, support actions and legal anchors.
- Produces: a consistent account hub and clear support/legal hierarchy without inventing settings or changing account permissions.

- [ ] Pin all current profile action destinations, sign-in/sign-out behaviour, legal anchors and notification/support IDs.
- [ ] Add failing tests for destination and accessibility invariants not yet covered.
- [ ] Apply scoped presentation refinements and only necessary semantic markup improvements.
- [ ] Run profile, session, notification, support, legal and static validation tests.
- [ ] Commit account/support slice.

### Task 7: Cross-screen verification and release readiness

**Files:**
- Modify tests/workflow only where verification shows a gap.
- Inspect all touched customer routes and generated preview.

**Interfaces:**
- Consumes: completed customer design foundation and each screen slice.
- Produces: evidence-backed readiness report for review; no automatic merge or production release.

- [ ] Run every existing UI, route, session, notification, PWA/offline and static-validation test relevant to the changed files.
- [ ] Verify viewport widths 320px, 360px, 390px, 768px, 1024px and desktop.
- [ ] Verify guest/signed-in, empty/error/loading, long-text and reduced-motion cases.
- [ ] Check keyboard focus, contrast, tap target size, page overflow, fixed navigation overlap and console/runtime errors.
- [ ] Perform a self-review against the approved spec and report any deferred items explicitly.
- [ ] Keep the branch unmerged and production untouched pending owner review.

## Execution Notes
- Execute in the listed order because later screens depend on shared token and UI contracts.
- Prefer CSS-only changes when they achieve the requirement without changing runtime behaviour.
- Do not use agent delegation for this work; execute directly in the current session.
- Do not merge, deploy, run migrations, modify live data, alter payment behaviour or activate billing/ads.
