# Doodhwala Customer Homepage Premium Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved premium, responsive Doodhwala customer homepage while preserving all existing marketplace behavior and runtime contracts.

**Architecture:** Keep the current static HTML/CSS/vanilla-JS architecture. Retain the existing homepage runtime and element hooks, reshape only homepage presentation in `index.html`, and make `marketplace-refresh.css` the primary owner of the refreshed homepage styling. Add source-contract coverage and keep the PWA precache/cache revision synchronized with any versioned asset changes.

**Tech Stack:** HTML, CSS, vanilla JavaScript, Node.js built-in `node:assert/strict` tests, existing service worker/PWA.

**Spec:** `docs/superpowers/specs/2026-10-30-customer-homepage-premium-redesign-design.md`

## Global Constraints

- Scope is the customer-facing homepage only.
- Preserve existing IDs, `data-filter` values, and runtime hooks consumed by `app.js` and `location.js`.
- Keep the existing seven-destination customer bottom navigation owned by `customer-nav.js`.
- Use real provider/catalogue data only; do not add mockup names, ratings, prices, distances, testimonials, or unsupported claims.
- Do not add paid APIs, packages, analytics, map providers, or infrastructure.
- Do not change payment, billing, Supabase schema/RPC/RLS, authentication policy, order lifecycle, pricing, delivery eligibility, or backend behavior.
- Do not redesign provider, admin, profile, checkout, product/store, plans, orders, support, or legal routes.
- Do not merge to `main`, deploy to production, or change live data.
- Avoid a new global CSS override layer; consolidate or edit existing homepage-owned rules instead.
- Honor `prefers-reduced-motion`, visible keyboard focus, accessible names, and mobile safe-area/layout constraints.

## Review Focus

- **Empty or failed provider catalogue:** provider discovery must retain understandable empty/error presentation and must not show fabricated fallback sellers. Pin with source-contract assertions for existing grid/state hooks and verify manually with empty/error fixtures if a browser/runtime fixture is available.
- **No delivery location selected:** location prompts and location picker remain reachable; no false nearby/distance claim is displayed. Pin existing location control IDs and labels in the homepage contract test.
- **Long provider names, prices, and unavailable optional fields:** cards must wrap/truncate without horizontal overflow and must not invent missing values. Pin card layout constraints in CSS review and test with long-content browser fixtures where available.
- **Keyboard-only and reduced-motion users:** controls retain visible focus and animation respects the user's motion preference. Pin CSS media/focus rules in the contract test.
- **Narrow mobile viewport and sticky/floating UI overlap:** the page must not horizontally scroll or hide content behind bottom navigation/cart/compare surfaces. Verify at 320px, 360px, and 390px widths plus tablet/desktop viewports.

---

## File Structure

- `index.html` — homepage semantic structure, hierarchy, content copy, and existing interaction hooks.
- `marketplace-refresh.css` — primary homepage visual system, card/layout styling, and responsive behavior.
- `customer-ui-polish.css` — modify only if inspection proves an existing homepage-specific later override conflicts; do not expand its shared-route rules.
- `scripts/test-homepage-premium-contract.mjs` — new Node source-contract test for required homepage hooks, honest content, accessibility/reduced-motion, and responsive safeguards.
- `scripts/test-pwa-offline-contracts.mjs` — update exact homepage stylesheet URL expectations if a versioned URL changes.
- `sw.js` — synchronize the new homepage stylesheet URL in `ASSETS` and `CORE_ASSETS`, and advance the cache revision only if the asset URL changes.
- `docs/superpowers/specs/2026-10-30-customer-homepage-premium-redesign-design.md` — approved design source; do not alter scope without approval.

No marketplace behavior, customer navigation, backend, or payment files are planned for modification. A narrowly scoped `app.js` edit is approved only to derive truthful card display labels and render their markup.

---

### Task 1: Establish homepage source-contract coverage

**Files:**
- Create: `scripts/test-homepage-premium-contract.mjs`
- Read: `index.html`
- Read: `app.js`
- Read: `location.js`
- Read: `customer-nav.js`
- Read: `marketplace-refresh.css`

**Interfaces:**
- Consumes: existing HTML IDs and `data-filter` hooks referenced by the current runtime.
- Produces: a runnable command, `node scripts/test-homepage-premium-contract.mjs`, that fails when required homepage hooks or core responsive/accessibility contracts are removed.

- [ ] **Step 1: Inventory runtime dependencies before writing assertions.**

  Inspect the actual `getElementById` / selector references in `app.js` and `location.js`, plus the category `data-filter` values and the customer navigation mount point. Record only homepage-critical hooks in the test.

- [ ] **Step 2: Write the failing homepage contract test.**

  Assert that `index.html` contains the existing critical hooks: `search`, `locationBtn`, `locationTop`, `locationLabel`, `heroLocationLabel`, `explore`, `how`, `providers`, `chips`, `providerSort`, `deliverableOnly`, `providersGrid`, `compareDock`, `compareDialog`, `openCart`, and `cartCount`. Confirm the category buttons retain `cow`, `buffalo`, `a2`, and `subscription` filter values. Assert that no hard-coded sample seller names, prices, ratings, or testimonials from the approved mockup are introduced. Assert the page retains semantic landmarks and that the active stylesheet includes responsive and reduced-motion/focus safeguards.

- [ ] **Step 3: Run the new test and confirm it fails for the expected reason.**

  Run: `node scripts/test-homepage-premium-contract.mjs`

  Expected: FAIL initially because the new test file or one or more newly specified assertions are not yet satisfied. Do not weaken assertions merely to make the test green.

- [ ] **Step 4: Commit the test-only baseline.**

  ```bash
  git add scripts/test-homepage-premium-contract.mjs
  git commit -m "test: add homepage redesign source contracts"
  ```

### Task 2: Reshape homepage hierarchy without breaking behavior

**Files:**
- Modify: `index.html`
- Test: `scripts/test-homepage-premium-contract.mjs`

**Interfaces:**
- Consumes: existing IDs, `data-filter` values, script load order, route URLs, and runtime hooks discovered in Task 1.
- Produces: a semantic homepage structure with a premium header/hero, scannable category shortcuts, prominent nearby providers, and secondary subscription discovery; all current interactions continue to bind.

- [ ] **Step 1: Add/adjust the test assertions for the approved section order and primary actions.**

  Assert the document contains one primary page `h1`, a clearly named nearby-provider section, the existing category controls, and the current cart/location controls. Assert all critical IDs and filter values remain unique and present.

- [ ] **Step 2: Run the focused contract test to verify the hierarchy assertions fail before the markup change.**

  Run: `node scripts/test-homepage-premium-contract.mjs`

  Expected: FAIL only on the newly introduced hierarchy assertion(s).

- [ ] **Step 3: Update homepage markup in `index.html`.**

  Implement the approved hierarchy: brand and location utilities, prominent search, concise marketplace hero, category tiles, nearby independent providers, and secondary subscription/brand explanation. Keep current element IDs and data hooks in place. Preserve cart drawer, compare dialog, location picker, help/updates/account links, legal footer, and script order. Use only claims supported by existing product behavior/data.

- [ ] **Step 4: Run the homepage contract test.**

  Run: `node scripts/test-homepage-premium-contract.mjs`

  Expected: PASS for section order, primary actions, unique IDs, and preserved runtime hooks.

- [ ] **Step 5: Commit the markup change.**

  ```bash
  git add index.html scripts/test-homepage-premium-contract.mjs
  git commit -m "feat: refine customer homepage structure"
  ```

### Task 3: Implement the premium responsive visual system

**Files:**
- Modify: `marketplace-refresh.css`
- Modify only if required: `customer-ui-polish.css`
- Test: `scripts/test-homepage-premium-contract.mjs`

**Interfaces:**
- Consumes: the semantic homepage structure from Task 2 and the existing brand tokens in `styles.css`.
- Produces: mobile-first styling for the approved green/off-white/white visual direction, clear hierarchy, compact utility surfaces, readable provider cards, and responsive grids without altering shared route styling.

- [ ] **Step 1: Add failing CSS contract assertions.**

  Assert the homepage stylesheet defines responsive breakpoints, visible `:focus-visible` styling or preserves the shared base focus rule, a `prefers-reduced-motion: reduce` rule, and mobile overflow/tap-target safeguards. Avoid asserting arbitrary colors or exact pixel values where the approved spec leaves design discretion.

- [ ] **Step 2: Run the focused contract test.**

  Run: `node scripts/test-homepage-premium-contract.mjs`

  Expected: FAIL on the new CSS assertions before the visual implementation.

- [ ] **Step 3: Refine the existing homepage-owned CSS.**

  Edit `marketplace-refresh.css` rather than adding a new stylesheet. Establish balanced content width, responsive hero, consistent category tiles, readable provider cards, clear active/filter states, controlled shadows, and restrained glass only on compact utility surfaces. Keep provider data and transactional surfaces high contrast. Add reduced-motion overrides and ensure fixed/sticky controls do not obscure content. Reconcile a conflicting later homepage rule in `customer-ui-polish.css` only if necessary.

- [ ] **Step 4: Run the homepage contract test.**

  Run: `node scripts/test-homepage-premium-contract.mjs`

  Expected: PASS for responsive, focus, and reduced-motion source contracts.

- [ ] **Step 5: Commit the CSS change.**

  ```bash
  git add marketplace-refresh.css customer-ui-polish.css scripts/test-homepage-premium-contract.mjs
  git commit -m "feat: style premium responsive customer homepage"
  ```

### Task 4: Keep PWA asset caching consistent

**Files:**
- Modify if stylesheet URL changes: `index.html`
- Modify if stylesheet URL changes: `sw.js`
- Modify if stylesheet URL changes: `scripts/test-pwa-offline-contracts.mjs`
- Test: `scripts/test-homepage-premium-contract.mjs`

**Interfaces:**
- Consumes: final homepage stylesheet URL from Task 3.
- Produces: an exact, precached stylesheet URL and monotonic cache revision when required; the PWA offline contract remains authoritative.

- [ ] **Step 1: Decide whether the existing stylesheet URL needs a version bump.**

  If the URL remains `/Doodhwala/marketplace-refresh.css?v=20261025.3`, do not modify the service worker solely to create churn. If it changes, use a new version string and update every required reference consistently.

- [ ] **Step 2: Update the PWA contract test first when the URL changes.**

  Assert the new exact stylesheet URL appears in both the worker's required cache list and the homepage link reference. Run: `node scripts/test-pwa-offline-contracts.mjs`

  Expected: FAIL until the worker and HTML references are synchronized.

- [ ] **Step 3: Update `index.html`, `sw.js`, and the PWA contract test together when required.**

  Add the new exact URL to `ASSETS` and `CORE_ASSETS`, update the cache revision monotonically, and replace the old exact URL expectation in the test. Do not remove unrelated cached routes or assets.

- [ ] **Step 4: Run PWA and homepage source-contract tests.**

  Run: `node scripts/test-pwa-offline-contracts.mjs && node scripts/test-homepage-premium-contract.mjs`

  Expected: both PASS.

- [ ] **Step 5: Commit the cache-contract change only if one was needed.**

  ```bash
  git add index.html sw.js scripts/test-pwa-offline-contracts.mjs
  git commit -m "fix: sync homepage stylesheet with offline cache"
  ```

### Task 5: Regression verification and final review

**Files:**
- Read/run: all existing `scripts/test-*.mjs` contracts relevant to customer homepage, navigation, profile shell, and PWA.
- Review: complete branch diff.

**Interfaces:**
- Consumes: all implementation tasks above.
- Produces: a verified branch report distinguishing automated source checks from browser/device checks.

- [ ] **Step 1: Discover all existing repository contract tests.**

  Run: `find scripts -maxdepth 1 -type f -name 'test-*.mjs' -print | sort`

  Record the actual discovered test list; do not assume a root package script exists.

- [ ] **Step 2: Run the relevant source-contract tests.**

  Run: `for f in scripts/test-*.mjs; do node "$f" || exit 1; done`

  Expected: all discovered Node contract tests PASS. If an unrelated pre-existing test fails, capture its exact output and establish whether the failure is introduced by this branch before making changes.

- [ ] **Step 3: Run JavaScript syntax checks for changed JavaScript files.**

  If no JavaScript runtime file changed, record this check as not applicable. If a runtime file was changed with separately approved scope, run `node --check path/to/file.js` for each changed JavaScript file.

- [ ] **Step 4: Review scope and diff.**

  Run: `git diff --check && git diff --stat && git diff --name-only`

  Expected: no whitespace errors and only the planned homepage, test, PWA-if-needed, and documentation files are changed. Confirm no payment, billing, backend, Supabase, auth-policy, order, admin, profile, or production configuration changes.

- [ ] **Step 5: Perform browser visual checks if a supported browser is available.**

  Check 320px, 360px, 390px, tablet, 1280px desktop, and wide desktop. Verify no horizontal overflow; no content behind bottom navigation; location picker, search, categories, filters, sort, compare, saved, cart, and checkout navigation remain operable; empty/error provider states are legible; keyboard focus and reduced-motion behavior work. If no browser is available, report visual checks as pending and provide this exact manual checklist rather than claiming success.

- [ ] **Step 6: Complete Fullstack Dev Kit review and report.**

  Review changed files against this plan and the approved spec. Report commits, exact tests and results, browser/device validation status, known limitations, and confirmation that the branch has not been merged or deployed.

---

### Task 6: Make nearby provider cards genuinely useful and data-honest

**Files:**
- Modify: `app.js` (presentation-only provider card view model and markup)
- Modify: `marketplace-refresh.css` (provider-card visual hierarchy and responsive styling)
- Modify: `scripts/test-homepage-premium-contract.mjs` (pure view-model behavior and source-contract assertions)

**Interfaces:**
- Consumes: the current `mapRemoteProvider` result shape: `productPrices`, `milks`, `rating`, `isServiceable`, `distanceKm`, `area`, `delivery`, `productIds`, and `productDailyAvailable`.
- Produces: `providerCardSummary(p)` with `startingPrice`, `ratingLabel`, `optionCount`, `serviceLabel`, and `serviceState`; the renderer uses it for a compact summary without changing actions or data retrieval.

- [ ] **Step 1: Write the failing view-model tests.**
  Assert the lowest finite positive price is selected; missing/non-positive prices produce no starting price; absent/zero ratings produce “No ratings yet”; true/false/null serviceability produce distinct labels; and actual milk-row count is shown.

- [ ] **Step 2: Run the source-contract test to confirm it fails because the view-model and truthful card summary are not implemented.**
  Run: `node scripts/test-homepage-premium-contract.mjs`.

- [ ] **Step 3: Implement the pure provider-card summary and safe mapping.**
  Keep query inputs and all action handlers untouched. Stop converting absent rating aggregates to `0.0`; remove the hard-coded client `verified: true` presentation signal. Do not change RPCs, filter logic, add/plan guards, save/compare behavior, store navigation, or pagination.

- [ ] **Step 4: Update only provider-card markup.**
  Add factual starting-price, rating, option-count and delivery-eligibility summaries. Preserve the product rows and all existing data attributes and controls exactly.

- [ ] **Step 5: Refine card styling for fast scanning.**
  Use a clear provider identity, compact factual summary and strong store action. Keep price and delivery state high-contrast; support long seller names and narrow widths without horizontal overflow.

- [ ] **Step 6: Run the homepage test, full source-contract suite, syntax checks and diff review.**
  Verify empty/error/loading states and all existing hooks remain intact. Browser/device visual testing remains a separate gate if no connected browser is available.

- [ ] **Step 7: Commit the provider-card refinement to the existing draft PR.**
  Use a descriptive commit message; do not merge or deploy to production.

---
### Task 7: Consolidate the brand story and improve mobile footer readability

**Files:**
- Modify: `index.html` — one story card with three grounded benefit labels
- Modify: `marketplace-refresh.css` — integrated benefit tiles, category caption sizing and footer typography/tap targets
- Modify: `scripts/test-homepage-premium-contract.mjs` — story structure, honest-benefit and footer accessibility contracts
- Modify stylesheet version references: `index.html`, `sw.js`, `scripts/test-marketplace-refresh.mjs`, `scripts/test-pwa-offline-contracts.mjs`, `scripts/test-pwa-browser-smoke.mjs`

**Interfaces:**
- Consumes: existing homepage brand-story section, existing `.stats` presentation hook, legal footer markup and versioned `marketplace-refresh.css` asset.
- Produces: one consolidated story surface; three plain-language benefit tiles (independent sellers, listed milk choices, direct orders); readable footer links and draft disclaimer; current stylesheet version in the service-worker precache.

- [ ] **Step 1: Add source-contract assertions before markup/style changes.**
  Assert there is one story card containing all three benefits, no unsupported numeric headline metrics, category captions remain at least 9px, footer links have at least 38px minimum height, and the legal disclaimer is at least 11px.

- [ ] **Step 2: Run the homepage source-contract test and confirm it fails on the current separate panels and unsupported numeric metrics.**

- [ ] **Step 3: Move the benefit tiles inside the existing story surface and replace unsupported metrics with grounded benefit labels.**
  Preserve the pending legal review disclaimer and do not imply customer support is available.

- [ ] **Step 4: Refine mobile styles.**
  Make the story a single compact panel, improve caption readability, and give legal links comfortable tap targets. Preserve bottom-navigation safe-area spacing.

- [ ] **Step 5: Advance the homepage stylesheet URL and update all service-worker precache and contract references together.**
  Do not change the shared cache namespace or unrelated route assets.

- [ ] **Step 6: Run homepage, marketplace refresh, PWA offline contract, service worker and PWA browser smoke checks; review the final diff.**

- [ ] **Step 7: Confirm the Doodhwala Assist launcher remains single-mounted.**
  Do not attempt to remove a preview/browser toolbar overlay unless it is shown to originate from application markup in a normal viewport.

- [ ] **Step 8: Commit the completed refinement to the existing draft PR.**

---
## Execution boundaries

- Work only on `feature/customer-homepage-premium-redesign`.
- Do not merge or deploy.
- `app.js` may be changed only for provider-card presentation rendering and null-safe display mapping, with source-contract coverage; do not change query arguments, RPCs, write operations, event semantics, product guards, delivery eligibility, or order behavior.
- Stop and request approval before any change to `location.js`, `customer-nav.js`, backend, payment, billing, or shared customer routes.
- Do not claim E2E, coverage, or physical-device validation unless the repository/tooling actually supports and runs those checks.
