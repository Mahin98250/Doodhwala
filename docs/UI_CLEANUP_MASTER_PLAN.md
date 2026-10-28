# Doodhwala Whole-App Clean UI Audit & Master Checklist

**Status:** Implementation in progress — repository audit baseline retained; shared UI foundation is under review in PR #118  
**Baseline branch:** `main`  
**Baseline commit:** `46b48d20c896bee9f96902d2fc2fbee0f1fc0158`  
**Chosen direction:** soft glass accents + balanced density + cinematic, purposeful motion  
**Product constraint:** Keep the experience simple for customers and independent milk sellers. Preserve existing business logic, authentication, database/RLS rules, payment safety controls, PWA/offline behaviour and direct navigation.

## 1. Audit scope and confidence

The repository tree was inventoried at the baseline commit (237 tracked files). The inventory includes customer marketplace, auth, checkout, product/store, plans, orders, notifications, support/legal, provider console, admin console, PWA/service worker, shared styles/scripts, Supabase migrations, SQL tests and CI workflows.

This is a **repository and architecture inventory**, not a claim that every route has been visually tested in a live browser. Current evidence does not establish that all pages have been opened on real mobile/desktop devices or that all role-specific end-to-end flows pass. Those checks remain explicit release gates below.

## 2. Initial audit findings

### P0 — consistency and regression risks to investigate first

- [ ] **Layered CSS needs a dependency audit.** The customer home imports multiple styling layers (base styles, experience layer, marketplace refresh, customer polish, milk transition and splash). Map selector ownership, import order, duplicate overrides and specificity before consolidating anything.
- [ ] **Route variants must remain equivalent.** The repository contains root HTML files and directory-style route entry points (for example `auth.html` and `auth/index.html`, plus similar patterns for admin, checkout, plans, orders, product, provider, notifications, support, legal, store and offline). Compare content, asset paths, cache versions and navigation destinations so one entry point does not drift or 404.
- [ ] **Preserve role and data boundaries.** Admin/provider/customer pages must not leak privileged actions or private fields through a UI refactor. UI hiding is not authorization; retain backend RLS, secure RPCs, server-side validation and role checks.
- [ ] **Preserve payment safety.** Current docs state the automated gateway is not ready to move money. UI must never imply payment settlement from a redirect/client event or mark an order paid without authoritative server confirmation.
- [ ] **PWA/offline assets and cache revision.** Every shared UI asset and route shell change must be checked against service-worker precache/runtime rules, cache invalidation and offline fallback tests.
- [ ] **Avoid broad visual rewrites before baseline screenshots and tests.** Record current route coverage, existing functionality and console/network errors before replacing shared tokens or navigation.

### P1 — complete shared design system

- [ ] Define semantic tokens for background/surface/elevated surface, text/muted text, border, primary/hover/focus, success/warning/error/info, overlay and scrim.
- [ ] Establish a restrained glass recipe: readable opaque base, subtle translucent surfaces only where useful, controlled blur, quiet border/highlight, no low-contrast text, and solid fallback where backdrop-filter is unsupported.
- [ ] Define type scale, line-height, font weights, content widths, spacing scale, radii, shadows/elevation and motion durations/easing.
- [ ] Standardize buttons (primary/secondary/tertiary/destructive/icon), inputs, selects, checkboxes, search, cards, chips, tabs, badges, tooltips, dialogs, drawers, toasts, tables, pagination, skeletons and empty/error states.
- [ ] Standardize focus-visible rings, hover/pressed/disabled/loading states and touch targets.
- [ ] Define reusable responsive breakpoints and layout rules; prevent horizontal page overflow.
- [ ] Create icon rules (consistent icon set, stroke weight and size); replace inconsistent Unicode symbols where practical without changing behaviour.
- [ ] Create motion guidelines: cinematic intro is optional and short; navigation and task flows stay fast; no blocking animation; support `prefers-reduced-motion`; skip intro; avoid motion on every card/action.
- [ ] Add documentation/examples for components and visual regression baselines before mass adoption.

### P1 — customer journey

- [ ] Home: hero hierarchy, location prompt, search, categories, provider discovery, filter/sort controls, comparison dock/dialog, responsive card grid and footer.
- [ ] Search/discovery: clear query, no-results state, loading/error states, filter chips, sort controls, distance/availability explanations and accessible controls.
- [ ] Provider/store/product: identity and verification status, milk type, price/unit, availability, delivery coverage/timing, product selection and clear add-to-cart feedback.
- [ ] Cart/drawer: item quantities, provider grouping, subtotal, empty state, unavailable products and clear checkout action.
- [ ] Auth: sign-in/sign-up/OAuth/profile completion, validation messages, pending states, password visibility and recoverable errors.
- [ ] Address/location: permission denied, unavailable GPS, manual location, invalid pin, loading, save/edit and persistence states.
- [ ] Checkout: address review, provider grouping, delivery expectations, payment choice, duplicate-submit prevention, safe errors and success/track-order path.
- [ ] Orders: readable status timeline, empty/loading/error/offline states, refresh/reconnect handling and clear next action.
- [ ] Plans/subscriptions: schedule/quantity preview, pause/resume/cancel states, capacity constraints, next delivery and confirmation dialogs.
- [ ] Saved items, notifications and support: consistent lists, unread states, accessible forms and clear confirmation/error messages.
- [ ] Legal: readable content hierarchy, responsive long-form layout and clear indication where policies remain drafts pending review.

### P1 — seller/provider journey

- [ ] Onboarding: clear step count, validation, progress, back/continue, save/resume and helpful field explanations.
- [ ] Provider dashboard: prioritise today's orders, action-required items, availability and profile readiness; avoid overwhelming KPI clutter.
- [ ] Catalogue: add/edit/delete/activate/pause, stock/availability, price/unit, search/filter and confirmation for destructive actions.
- [ ] Service area and schedule: explain locality, PIN/radius and delivery windows; handle invalid/incomplete location input.
- [ ] Order queue: legible status, customer/order details permitted for the seller, empty/loading/error states and duplicate-action prevention.
- [ ] Lifecycle actions: only offer valid next states; display pending/success/failure feedback and preserve backend-enforced transitions.
- [ ] Seller profile/trust: clear verification status and outstanding actions; never imply approval before backend confirmation.
- [ ] Provider mobile navigation and desktop sidebar: consistent active states, labels, back behaviour and safe-area spacing.

### P1 — owner/admin journey

- [ ] Admin overview: define information hierarchy and ensure charts/totals have loading, empty, stale and error states.
- [ ] Seller moderation: pending/approved/rejected/suspended states, reason capture and confirmation for high-impact actions.
- [ ] Customer, orders and subscriptions: consistent filters, search, pagination, detail panels and empty/error states.
- [ ] Analytics: label metrics and time windows; avoid misleading demo data or unverified live claims.
- [ ] System health/security: distinguish informational warnings from actionable incidents; never expose secrets or private user data.
- [ ] Admin navigation and tables: keyboard-accessible controls, responsive overflow handling and clear destructive-action confirmation.
- [ ] Ensure each admin endpoint/action remains authorized server-side; do not trust client-only route guards.

### P2 — motion, polish and responsive quality

- [ ] Define cinematic motion as a small set of branded moments (startup/transition/confirmation), not continuous decoration.
- [ ] Ensure the startup screen cannot trap navigation, block critical content or repeatedly replay within the same session.
- [ ] Check mobile safe areas, landscape/short-height screens, 320px-width devices, large text and browser zoom.
- [ ] Respect reduced motion and avoid flashing/parallax that can trigger discomfort.
- [ ] Optimize large images, avoid unnecessary blur layers, avoid layout shifts and measure interaction responsiveness on low-end phones.
- [ ] Verify contrast over translucent surfaces in every theme/state; provide non-glass fallback.

### P0 — functionality and accessibility release gate

- [ ] No broken internal links, 404 route variants, console errors or missing assets.
- [ ] Every visible interactive control has a working action, a clear disabled state or is removed.
- [ ] Keyboard-only journey works for menus, dialogs, drawers, forms and checkout; focus is visible and restored appropriately.
- [ ] Forms have associated labels, useful validation, clear error announcements and correct input types.
- [ ] Semantic landmarks/headings, accessible names, alt text and dialog semantics are present.
- [ ] Automated checks cover CSS/JS syntax, links/routes, shared UI contracts and service-worker cache contracts.
- [ ] Test viewport matrix: small Android phone, standard phone, tablet, laptop and wide desktop; include landscape and reduced-motion mode.
- [ ] Test network states: slow/failed network, offline launch, stale cache, reconnection and session expiry.
- [ ] Test real staging end-to-end: customer checkout → provider queue → provider status transitions → customer tracking, using authorized staging accounts and non-production data.
- [ ] Verify auth, RLS, secure RPC permissions, payment status boundaries and admin/provider authorization have not changed.
- [ ] Wait for all required PR CI checks to complete successfully; inspect changed files and check results before merge.
- [ ] After merge, verify GitHub Pages deployment and inspect the live app on a real device. CI success alone is not proof of visual correctness or backend E2E success.

## 3. Prioritised delivery plan

| Priority | Workstream | Output / exit criteria |
|---|---|---|
| P0 | Baseline audit | Route/file inventory, CSS ownership map, functionality map, screenshots, broken-link/console baseline and risk register |
| P0 | Shared tokens and primitives | Documented tokens/components with contrast, focus, reduced-motion and fallback rules |
| P1 | Customer core | Home → discovery → product/store → cart → checkout → order tracking remains functional and visually consistent |
| P1 | Seller core | Onboarding → catalogue → availability → order queue → lifecycle remains functional and easy on mobile |
| P1 | Admin core | Moderation, order/customer/subscription management and health views consistent without weakening authorization |
| P1 | Secondary customer routes | Plans, saved, notifications, support, legal and profile states follow the same system |
| P2 | Motion and performance | Cinematic brand moments are short, skippable, responsive, accessible and measured |
| P0 release gate | Regression and release | Required CI green, staging E2E recorded, route/device review completed, Pages deployment verified |

## 4. Coordinated PR strategy

Use small, reviewable PRs that share the same design contract. Do not allow parallel workers to independently edit the same global CSS or navigation files.

1. **PR A — Audit and design contract:** this checklist, route inventory, CSS ownership map and visual standards. No production UI behaviour changes.
2. **PR B — Tokens and primitives:** shared CSS variables and reusable low-risk primitives, with screenshots/contract tests.
3. **PR C — Customer shell and home:** responsive shell/navigation and discovery UI, preserving all selectors and data contracts required by current JS.
4. **PR D — Customer transactional flow:** product/store/cart/checkout/orders, with regression tests and no payment/auth policy changes.
5. **PR E — Seller experience:** onboarding, dashboard, catalogue, service area and order queue.
6. **PR F — Admin/operations:** dashboard, moderation, tables and health panels.
7. **PR G — Secondary routes and motion:** plans, notifications, support/legal, startup and transitions.
8. **PR H — final quality gate:** cross-route visual/accessibility/device tests, cleanup, performance and deployment validation.

PRs may be split further if a workstream is large. Each PR must state changed routes, preserved behaviour, screenshots or before/after evidence, tests run, known limitations and rollback considerations. Merge only after required CI succeeds and review findings are resolved.

## 5. Working agreements for contributors

- One shared task board is the source of truth. Each task has an ID, priority, owner, files/routes, acceptance criteria, test evidence and status.
- Assign one owner for shared tokens/navigation. Other contributors consume the contract rather than creating competing global styles.
- Separate visual changes from backend/schema/security changes. Any unavoidable backend impact requires explicit review and independent tests.
- Do not change RLS policies, auth checks, payment state transitions, secrets, order calculations or production data as part of a UI-only task.
- Do not claim visual/device/E2E verification without recorded evidence.
- Avoid adding paid APIs, libraries or infrastructure unless explicitly approved. Prefer the existing static HTML/CSS/JS architecture and current tooling.
- Keep the customer and seller UI simple. Advanced admin capabilities should not spill into everyday customer/seller workflows.

## 6. Definition of done for the whole-app UI

- [ ] Every tracked user-facing route is inventoried and assigned a reviewed status.
- [ ] Shared tokens/components are used consistently; old overrides are removed only after usage and regression analysis.
- [ ] Customer, seller and admin primary journeys remain functional.
- [ ] No known broken links, missing assets, horizontal overflow or critical console errors.
- [ ] Responsive layouts and reduced-motion behaviour are checked on representative devices.
- [ ] Accessibility checks cover focus, labels, semantics, contrast and dialogs.
- [ ] PWA/offline cache and direct route entry remain correct.
- [ ] Staging E2E proves the real order journey without synthetic production data.
- [ ] Security/payment boundaries are unchanged and relevant tests pass.
- [ ] All required CI checks are green on the exact PR head; no merge while checks are pending or failing.
- [ ] Live deployment and a real-device visual review are recorded after merge.

**Next action:** validate the shared UI layer and PWA cache contract across all route variants, then continue in focused customer, seller, and owner UI passes. Browser/device QA remains a separate release gate.


## 7. Route-by-route asset ownership audit (static source inspection)

All route entry points below were read at baseline `46b48d20c896bee9f96902d2fc2fbee0f1fc0158`. The directory-style public routes and their corresponding root HTML files have matching Git blob SHAs for the checked pairs; they are currently exact-content aliases, not separate implementations. Keep this parity as a CI contract.

| User journey / route | HTML entry points | Page CSS layer(s) after shared base | Main page logic / shared runtime |
|---|---|---|---|
| Customer home/discovery | `index.html` | `styles.css`, `experience-layer.css`, `marketplace-refresh.css`, `customer-ui-polish.css`, `milk-transition.css`, `splash-screen.css` | `app.js`, `location.js`, `customer-nav.js`, `milk-transition.js`, `splash-screen.js`, Supabase client/config, resilience, session controls, PWA registration, network status |
| Sign in / account | `auth.html`, `auth/index.html` | `styles.css`, `auth.css`, `milk-transition.css` | `auth.js`, shared Supabase/resilience/session/PWA/network runtime, transition |
| Checkout | `checkout.html`, `checkout/index.html` | `styles.css`, `experience-layer.css`, `checkout.css`, `customer-journey-refresh.css`, `milk-transition.css` | `checkout.js`, customer navigation, Supabase/resilience/session/PWA/network runtime |
| Milk detail | `product.html`, `product/index.html` | `styles.css`, `experience-layer.css`, `market.css`, `customer-journey-refresh.css`, `milk-transition.css` | `product.js`, customer navigation, shared Supabase/resilience/session/PWA/network runtime |
| Seller/store details | `store.html`, `store/index.html` | Same customer detail stack as product, plus Leaflet CSS | `store.js`, customer navigation, Leaflet JS, shared runtime |
| Milk plans/subscriptions | `plans.html`, `plans/index.html` | `styles.css`, `experience-layer.css`, `plans.css`, `subscription-schedule-preview.css`, `customer-journey-refresh.css`, `customer-ui-polish.css`, `milk-transition.css` | `plans.js`, customer navigation, shared runtime |
| Orders/tracking/payment choice | `orders.html`, `orders/index.html` | `styles.css`, `experience-layer.css`, `orders.css`, `customer-journey-refresh.css`, `direct-upi-checkout.css`, `customer-ui-polish.css`, `milk-transition.css` | `orders.js`, `direct-upi-checkout.js`, customer navigation/10x helper, QRCode, shared runtime |
| Notifications | `notifications.html`, `notifications/index.html` | `styles.css`, `notifications.css`, `milk-transition.css` | `notifications.js`, shared Supabase/resilience/PWA/transition |
| Help and support | `support.html`, `support/index.html` | `styles.css`, `support.css`, `milk-transition.css` | `support.js`, shared runtime |
| Legal/policy pages | `legal.html`, `legal/index.html` | `styles.css`, `milk-transition.css` | Primarily static page plus resilience/PWA/network/transition |
| Seller onboarding/operations | `provider.html`, `provider/index.html` | `styles.css`, `experience-layer.css`, `provider.css`, `milk-transition.css`, Leaflet CSS | `provider.js`, `provider-location.js`, shared Supabase/resilience/PWA/network/transition |
| Owner/admin console | `admin.html`, `admin/index.html` | `styles.css`, `admin.css`, `milk-transition.css` | `admin.js`, `admin-intelligence.js`, shared Supabase/resilience/PWA/network/transition |
| Offline fallback | `offline.html`, `offline/index.html` | No external stylesheet/script links identified in page source; standalone inline fallback | Standalone offline explanation/link back to app |

### Shared runtime boundaries

- **Data/auth:** `supabase-config.js`, `supabase-client.js`, `auth.js`, `session-controls.js`.
- **Resilience/PWA:** `resilience.js`, `network-status.js`, `pwa-register.js`, `sw.js`.
- **Customer shell/navigation:** `customer-nav.js` and customer page scripts.
- **Motion:** `milk-transition.css/js` shared by many routes; treat it as a high-blast-radius component.
- **Seller/admin:** `provider.js` and `admin.js` are separate role-specific owners. Shared visual primitives must not merge their permissions/flows or blur role boundaries.

## 8. Specific source-level findings to turn into tickets

### P1 — PWA styling cache coverage
- [x] **Homepage refresh CSS precache verified:** `index.html` imports `/Doodhwala/marketplace-refresh.css?v=20261025.3`, and the exact URL is present in `sw.js` `CORE_ASSETS` (though not in `ASSETS`). There is no identified precache omission from this check. The real gap was test coverage: `scripts/test-pwa-offline-contracts.mjs` did not assert this critical core asset. PR #117 adds the explicit contract assertion.
- [x] Extend `scripts/test-pwa-offline-contracts.mjs` to assert the homepage's `marketplace-refresh.css?v=20261025.3` URL is present in the service-worker asset contract. Broader HTML-to-manifest consistency checking remains a separate follow-up; the current test does not prove every page asset is precached.\n- [ ] Review all current HTML query-string asset URLs against `ASSETS` and `CORE_ASSETS`, not just filenames. The service worker currently contains multiple historic versioned keys (for example different `styles.css`, `provider.css`, `plans.js`, `customer-nav.js`, `resilience.js` and `customer-ui-polish.css` variants). Keep only needed compatibility entries after testing cache migration and old-client recovery.
- [ ] Add a release test that detects an imported local CSS/JS URL omitted from the service-worker manifest and distinguishes core shell assets from optional enhancements.

### P1 — CSS ownership and design-token fragmentation
- [ ] `styles.css` establishes base tokens such as `--bg`, `--surface`, `--ink`, `--muted`, `--line`, `--green`, shadows and radii.
- [ ] `marketplace-refresh.css` separately declares `--market-*` tokens; `customer-journey-refresh.css` declares `--retail-*` tokens; individual page styles also contain hard-coded colors.
- [ ] `customer-ui-polish.css` contains targeted `!important` overrides. Preserve intentional contrast fixes, but document ownership and remove overrides only after screenshot/regression verification.
- [ ] `experience-layer.css` applies transitions/focus/interaction rules across broad selectors (buttons, links, inputs and role=button elements). Treat it as global behaviour and verify every role/route before changing.
- [ ] Home has the deepest visual cascade. Page stacks differ by route; do not blindly add glass effects globally. Define tokens first, then migrate one workstream/route group at a time.
- [ ] `milk-transition.css/js` is shared widely and creates a high-z-index transition overlay. Motion refactors must retain reduced-motion, interruption cleanup, back/forward navigation and non-blocking navigation.

### P1 — external runtime and graceful fallback
- [ ] Google Fonts are requested through a CSS import; preserve system fallbacks and confirm the interface remains readable when fonts/network are unavailable.
- [ ] Supabase JS, Leaflet and QRCode arrive from external CDNs on routes that need them. UI changes must retain visible failure/retry states and not assume a CDN/network is always available.
- [ ] Do not introduce new paid libraries/APIs for visual effects. Prefer CSS and existing assets; blur/glass must fall back cleanly on constrained devices.

## 9. Audit completion status

| Audit item | Status | Evidence / outstanding step |
|---|---|---|
| Tracked repository inventory | **Complete** | 237 tracked files inventoried; user-facing HTML/CSS/JS and CI/PWA areas identified |
| Main route and style/script imports | **Complete for listed public route HTML** | 13 route families mapped above, including root and directory-style aliases |
| Root/clean-route entry-point content parity | **Source-verified for the 12 listed aliases** | Matching Git blob SHAs observed for root HTML and corresponding `index.html` files |
| Initial CSS token/layer ownership | **Source-reviewed** | Base tokens plus `--market-*` and `--retail-*` extensions, broad interaction layer, high specificity customer overrides |
| Service-worker asset manifest vs route imports | **One critical asset contract added; broader audit pending** | Homepage refresh CSS is already in `CORE_ASSETS`; PR #117 adds a regression assertion. Full route-to-manifest coverage remains unverified |
| Visual/browser screenshots for all routes | **Not yet done** | Need real browser run, screenshots, mobile/tablet/desktop inspection |
| Keyboard/contrast/accessibility audit | **Not yet done** | Needs automated and manual execution, not inference from source |
| Auth/RLS/checkout/order live staging E2E | **Not yet done by this UI audit** | Must use authorized staging accounts; no synthetic production data |
| CI for the planning documentation PR | **Pending** | Run checks on the planning branch/PR before approval; UI implementation remains out of scope |

## 10. First implementation PR acceptance rules

The first implementation PR is limited to shared token/component foundations and audit-derived tests. It must not change payment, order, auth, provider approval, admin authorization, database schemas or real customer data. Before merging, compare screenshots for home, auth, product/store, checkout/orders, plans, provider and admin; verify clean URLs and root aliases; test reduced motion and offline asset contracts; and require every relevant CI check to pass on the exact PR head.


## 11. Proposed design-token contract (planning draft, not yet implemented)

Reuse existing brand values where sensible rather than inventing a second palette. These values are a proposed starting point and must be checked against contrast and screenshot evidence before being applied.

| Token | Proposed value / mapping | Usage |
|---|---|---|
| `--dw-canvas` | `#f5f7f3` (existing `--bg`) | Main app background |
| `--dw-surface` | `#ffffff` (existing `--surface`) | Forms, main content cards, tables and critical task surfaces |
| `--dw-surface-soft` | `#f8faf7` (existing `--surface-2`) | Quiet inset surfaces |
| `--dw-text` | `#17221a` (existing `--ink`) | Primary text |
| `--dw-text-muted` | `#6f7c73` (existing `--muted`) | Supporting text; validate small-text contrast before use |
| `--dw-border` | `#e2e8e1` (existing `--line`) | Dividers and card boundaries |
| `--dw-brand` | `#17603f` (existing `--green`) | Primary action and key brand accent |
| `--dw-brand-strong` | `#10482f` (existing `--green-dark`) | Active/pressed and high-emphasis brand states |
| `--dw-brand-soft` | `#e3f1e7` (existing `--green-soft`) | Soft selection and status backgrounds |
| `--dw-warning` | `#b47716` (existing `--amber`) | Warning states only; confirm contrast for text usage |
| `--dw-danger` | `#a3483e` (existing `--danger`) | Destructive/error states |
| `--dw-glass-bg` | `rgba(255,255,255,.76)` | Headers, floating navigation, location panels and selected overlays |
| `--dw-glass-border` | `rgba(255,255,255,.78)` plus a visible neutral border fallback | Separation against variable backgrounds |
| `--dw-glass-blur` | `16px` | Optional glass surfaces only; keep blur count low on mobile |
| `--dw-radius-sm / --dw-radius / --dw-radius-lg` | `10px / 16px / 22px` | Inputs, standard cards, dialogs/feature panels |
| `--dw-motion-fast / --dw-motion-ui` | `150ms / 220ms` | Press/hover feedback and ordinary transitions |
| `--dw-motion-ease` | `cubic-bezier(.2,.75,.25,1)` | Shared easing for ordinary UI transitions |

### Glass rules
- Keep the default content surface opaque. Use glass selectively for app headers, floating navigation, location pickers, small utility overlays and the startup/transition layer.
- Do not put translucent blur behind core reading surfaces, checkout totals, form labels, prices, seller order statuses, data tables or error/success messages.
- Always retain a visible edge against both light and green-tinted backdrops; the glass layer cannot be the only source of separation.
- Add `@supports` fallback to a solid/high-opacity surface for browsers without `backdrop-filter`, and verify colour contrast without blur.
- Avoid stacking multiple blurred layers; on smaller/low-end devices, prefer less blur rather than adding runtime work.

### Cinematic motion rules
- Brand intro and page transition are the only allowed cinematic sequences. They must be skippable or short, cannot hide an error, cannot block route changes, and must clean up on interruption/page lifecycle events.
- Everyday actions (filtering, quantity change, accepting an order, submitting checkout) use immediate feedback and short transitions. Do not make functional controls wait for decorative animations.
- Honour `prefers-reduced-motion: reduce` on every layer, not just the splash screen. Avoid large parallax, repeated card choreography and motion that obscures order status.
- Animation performance gate: inspect on a lower-end mobile profile, avoid layout-thrashing animations, and verify content remains usable if animations never run.

### Density and responsive contract
- Base spacing steps: `4, 8, 12, 16, 20, 24, 32, 40, 48px`; no page-specific random spacing values unless there is a documented reason.
- Use a balanced content density: readable sections and card groups, but no oversized vertical gaps that hide customer/provider tasks below the fold.
- Maintain primary task access at small phone widths, handle safe-area insets, avoid horizontal overflow, and support browser zoom / enlarged text.
- Keep DM Sans as the body typeface and Manrope as the heading/brand typeface unless a measured readability issue suggests otherwise; system fallbacks must always work.



## 8. Implementation progress — 28 October 2026

- PR #118 establishes the first semantic green-and-white UI foundation in `experience-layer.css`; the foundation remains a first phase, not a completion claim.
- Integrated the shared layer into the home, authentication, checkout, product, store, plans, orders, seller, notification, support, legal, and owner route families.
- Bumped the shared stylesheet URL to `experience-layer.css?v=20261028.3` so deployed browser and service-worker caches do not silently retain the previous stylesheet.
- Advanced the service-worker cache revision to `doodhwala-v106` and aligned the PWA contracts with the new exact asset URL.
- Added source-contract checks requiring each public route family and its directory alias to load the shared stylesheet and remain byte-for-byte equivalent.
- Automated checks still need to run against the final candidate SHA; rendered screenshots, physical-device QA, and authenticated staging journeys remain separate and are not inferred from source contracts.
