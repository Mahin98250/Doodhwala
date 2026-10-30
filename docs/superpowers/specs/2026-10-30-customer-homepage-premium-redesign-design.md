# Doodhwala Customer Homepage — Premium Redesign

**Status:** Approved by user on 2026-10-30  
**Date:** 2026-10-30  
**Scope:** Customer-facing homepage only  
**Implementation branch:** `feature/customer-homepage-premium-redesign`

## 1. Intent

Redesign the Doodhwala homepage to match the approved visual direction: a clean, premium, green-and-white local milk marketplace with a calm editorial hero, clear location and search controls, milk-category shortcuts, and prominent nearby independent-seller discovery.

The homepage should feel like a production-ready shopping app rather than a generic landing page. Its primary job is to help a customer find a relevant nearby independent milk seller and move confidently toward an order. Subscription discovery remains visible but secondary.

## 2. Goals

- Translate the approved mockup's visual language into the real Doodhwala homepage.
- Establish a clear first-screen hierarchy: brand/location, search, concise hero, primary discovery action.
- Make milk categories easy to scan and use.
- Make nearby provider cards feel trustworthy, legible, and easy to compare.
- Keep the existing customer marketplace functional on small phones, larger phones, tablets, laptops, and wide screens.
- Improve semantic structure, keyboard focus, accessible names, reduced-motion behavior, and loading/empty/error states where touched.
- Preserve the existing local-seller-only marketplace identity and current green-and-white cow-mascot branding.

## 3. Non-goals

- No redesign of provider, admin, profile, checkout, product/store, plans, orders, support, or legal routes in this delivery.
- No new payment gateway, payment processing, billing, seller subscription billing, or real-money flow.
- No Supabase schema, RPC, RLS, authentication, order lifecycle, pricing, delivery eligibility, or backend changes.
- No migration to React, Next.js, or another framework.
- No new paid APIs, packages, analytics, map providers, or infrastructure.
- No merge to main, production deployment, or live data changes without separate explicit approval.

## 4. Anti-goals

- Do not copy illustrative sample provider names, ratings, prices, distances, testimonials, or promotional claims from the mockup into the live product.
- Do not imply guarantees such as same-day delivery, quality certification, freshness claims, or seller verification unless existing trusted data explicitly supports them.
- Do not hide important functionality behind decorative animation or oversized hero content.
- Do not add another broad global CSS override layer or change shared navigation behavior as part of this homepage task.
- Do not replace working marketplace controls with static mockup-only elements.

## 5. Current implementation findings

- `index.html` is the homepage entry point and contains the existing app shell, header, hero, milk-category shortcuts, provider discovery, seller comparison dialog, story section, cart drawer, how-it-works modal, and location picker.
- Homepage runtime is primarily `app.js`; it already handles provider discovery, search, category filters, serviceability filtering, sorting, comparison, saved providers, cart updates, and navigation hooks.
- Location selection is handled by `location.js`; the page also loads the existing Supabase client/config, resilience bootstrap, PWA registration, network status, and session controls.
- Mobile customer navigation is mounted by `customer-nav.js` and currently has seven destinations. It is shared across customer routes and is out of scope for visual restructuring here.
- The homepage currently loads a deep CSS cascade: `styles.css`, `experience-layer.css`, `marketplace-refresh.css`, `customer-ui-polish.css`, `milk-transition.css`, `splash-screen.css`, `customer-ui-stability.css`, and `doodhwala-ui-system.css`.
- The base stylesheet already defines brand colors, typography, radii, shadows, and focus styling. The marketplace refresh layer already owns much of the retail homepage styling, while later layers contain mobile/header and stability corrections.
- The repository contains Node-based source-contract tests, including a PWA offline contract test. A package manifest was not found at the repository root in this inspection; test commands and available browser tooling must be confirmed from repository scripts/config before implementation.
- Source inspection does not establish that the current page has been visually verified in a real browser or on physical devices. Those checks must be reported as pending unless actually run.

## 6. Approaches considered

### A. Full visual replacement

Replace the homepage structure and reconnect all marketplace interactions.

- **Benefit:** maximum freedom to reproduce the mockup.
- **Trade-off:** highest regression risk because existing runtime code expects current element IDs and data hooks.

### B. Gradual polish of the existing layout

Keep the current homepage composition and make incremental styling adjustments.

- **Benefit:** lowest implementation risk.
- **Trade-off:** unlikely to deliver the strong visual transformation approved by the user.

### C. Premium redesign with existing functionality preserved — selected

Reshape the homepage's visual hierarchy and presentation to match the approved mockup while retaining existing IDs, runtime contracts, marketplace data, and customer flows.

- **Benefit:** meaningful visual change while preserving proven functionality.
- **Trade-off:** requires careful coordination between HTML structure, existing CSS ownership, responsive behavior, and contract tests.

**Selection:** The user explicitly selected approach C on 2026-10-30.

## 7. Proposed experience

### 7.1 Header and first screen

- Keep Doodhwala mascot and wordmark as the brand anchor.
- Present the selected delivery location clearly and keep it actionable.
- Make search prominent and preserve the existing search input contract.
- Keep account/help/updates/cart actions available without overcrowding the mobile header.
- Use a compact premium hero with concise marketplace positioning and a clear route into nearby sellers.
- Retain the seller onboarding entry point without allowing it to compete with the customer purchase action.

### 7.2 Milk categories

- Use a compact, consistent category tile system for Cow, Buffalo, A2, and Daily Plan.
- Preserve existing `data-filter` values and filter behavior.
- Do not add unsupported product claims to category subtitles.

### 7.3 Nearby providers

- Make nearby independent providers the primary content section after the hero/categories.
- Keep filter chips, delivery-only control, sort selection, provider count/hint, provider grid, compare dock, and comparison dialog functional.
- Provider cards must render actual catalogue data from the existing runtime. Preserve unavailable/empty values honestly.
- Make subscription availability discoverable as a secondary action when the seller/catalogue data supports it.
- Preserve pagination/load-more and empty/error states.

### 7.4 Brand and trust section

- Keep a concise explanation of Doodhwala's local independent-seller model.
- Remove or avoid numeric/absolute claims that are not backed by verifiable product data.
- Keep legal links and the existing legal-draft caveat intact.

### 7.5 Cart, location, and navigation

- Preserve cart drawer open/close, quantity updates, totals, and checkout navigation.
- Preserve location picker open/close, current-location flow, map selection, and labels.
- Preserve bottom navigation and all seven destinations; do not move its ownership into homepage markup.
- Preserve deep-link query behavior for provider/saved/cart views.

## 8. Visual and responsive direction

- Palette: existing Doodhwala greens, warm off-white canvas, white surfaces, restrained neutral borders, and existing typography.
- Use clean spacing, strong type hierarchy, rounded cards, subtle elevation, and selective glass only for compact utility surfaces such as the header or floating controls.
- Core content surfaces, provider prices, delivery states, forms, and errors remain opaque and high-contrast.
- Motion should be short, functional, and skippable; honor `prefers-reduced-motion`.
- Mobile-first: avoid horizontal overflow, preserve safe-area spacing, ensure tap targets are comfortably sized, and prevent sticky/floating elements from obscuring content.
- Tablet/desktop: use a balanced content width and responsive provider grid without stretching cards excessively.
- Preserve readable fallbacks when remote fonts, maps, or other optional CDN resources are unavailable.

## 9. Implementation boundaries and likely files

Expected primary files:
- `index.html` — homepage semantic structure and preserved IDs/data hooks.
- `marketplace-refresh.css` — primary homepage visual ownership and responsive layout.
- `customer-ui-polish.css` only if an existing later override must be reconciled; avoid adding redundant rules.
- `scripts/test-homepage-premium-contract.mjs` — new source-contract checks for required hooks and scope boundaries, unless an existing homepage test is discovered and should be extended instead.
- `sw.js` and homepage asset URL references only if a versioned asset URL changes and the PWA cache contract requires it.

Do not modify `app.js`, `location.js`, `customer-nav.js`, Supabase files, checkout/payment files, or shared role routes unless inspection proves a minimal compatibility fix is essential. If such a change becomes necessary, stop and explain the scope expansion before proceeding.

## 10. Acceptance criteria

1. The homepage has the approved premium visual hierarchy: brand/location/search, concise hero, category shortcuts, and prominent nearby providers.
2. Existing IDs and data hooks used by `app.js` remain available or are migrated atomically with explicit tests.
3. Search, category filters, sorting, delivery-only filtering, provider pagination, provider comparison, saved providers, cart drawer, quantity changes, totals, checkout navigation, location picker, and home navigation continue to work.
4. Real provider/catalogue data is displayed; no mockup sample data or unsupported claims are introduced.
5. Empty, loading, and recoverable error states remain understandable and accessible.
6. Layout works at representative phone, tablet, and desktop widths without horizontal overflow or content hidden behind navigation.
7. Keyboard focus, semantic headings/landmarks, accessible control names, labels, and reduced-motion behavior are preserved or improved.
8. Existing relevant source-contract and PWA tests pass; new homepage contracts cover critical hooks and asset-cache consistency.
9. No payment, billing, database, RLS, auth-policy, order logic, or production configuration is changed.
10. The final report distinguishes automated test results from browser/device visual checks; no unrun check is reported as passed.

## 11. Verification plan

- Discover and run the repository's existing Node source-contract tests relevant to homepage, navigation, PWA assets, and customer runtime.
- Run JavaScript syntax checks for any changed runtime files; avoid runtime edits unless essential.
- Validate HTML references and CSS asset versioning against the service-worker cache manifest.
- Run available lint/build/test commands only if they exist in the repository; do not invent a build command.
- Inspect the full diff for unintended shared-route, payment, backend, or security changes.
- Perform browser viewport checks if a supported browser environment is available. If not, state that visual browser/device validation remains outstanding and provide a precise manual test checklist.
- Run the Fullstack Dev Kit self-review and applicable coverage/e2e gates. If the repository has no coverage or E2E setup, report those gates as not applicable rather than fabricating results.

## 12. Builder decisions

The implementation owner may decide exact spacing, card proportions, breakpoint values, and whether an existing homepage-only style block should be moved or consolidated, provided that:
- the approved visual direction remains intact;
- shared route styling is not unintentionally changed;
- existing functional contracts remain intact;
- no unsupported data or claims are added; and
- any scope expansion is brought back for approval.

## 13. Approved 10X provider-discovery refinement

Following real-device review, the customer homepage now has an additional presentation-only refinement for nearby provider cards. This is part of the existing customer-homepage scope and does not change catalogue queries, seller records, eligibility rules, product pricing, or order behavior.

- Add a high-signal card summary using only returned provider/catalogue fields: lowest valid positive product price, count of available milk rows, actual positive rating when present, and the explicit delivery-eligibility state.
- Treat missing/zero rating aggregates as 'No ratings yet'; never render a synthetic 0.0 rating.
- Do not display an unconditional 'Verified' badge derived from a hard-coded client flag.
- Treat missing/non-positive prices as unavailable; do not display a zero or estimated 'starting from' price.
- Distinguish serviceability true, false, and null; an unknown state must never look like confirmed delivery availability.
- Preserve product IDs, product-price validation, Add/Plan button guards, compare/save/store routes, pagination, loading/error/empty states and event delegation.
- Keep product rows and existing interaction controls intact. Any edit to app.js is restricted to presentation rendering and mapping away unsupported display defaults; no query arguments, RPCs, write operations or business rules change.
- Visually prioritize provider identity, useful facts and a clear store action on phone screens; maintain responsive multi-column layout on larger viewports.