# Doodhwala Whole-App Clean UI Audit & Master Checklist

**Status:** Planning baseline — audit inventory completed; implementation not started  
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

**Next action:** complete the detailed route-by-route baseline (including CSS/JS ownership and direct-link parity), then propose the shared design tokens before implementing the redesign.
