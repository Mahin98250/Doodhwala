# SDD ledger — plan: docs/superpowers/plans/2026-10-30-customer-app-10x-redesign.md

## Workspace and pre-flight
- Implementation ref: `feature/customer-app-10x-redesign`, created from main commit `dba11d39ae149d0b57fb36003da7d9330aba8b0b`.
- Workspace note: a local clone/worktree could not be created because this runtime cannot resolve github.com. The GitHub branch is isolated, and all writes are scoped to that branch. No main-branch writes were made.
- Ruling: use the isolated GitHub feature branch with connector-based commits — local git clone/worktree is unavailable due to network DNS failure, and the remote branch keeps the work isolated — cost if wrong: local-only browser tooling and command execution must wait for CI/preview or a connected local checkout.
- Pre-flight interface: Task 1 produces `--dw-*` tokens; Task 2 consumes them in shared route-scoped CSS. The Task 2 contract asserts token use and route coverage.
- Ruling: store the new token set in `doodhwala-ui-system.css`, not `styles.css` — it is already linked across customer-facing routes, while `styles.css` is a large legacy base stylesheet — cost if wrong: pages missing the shared UI stylesheet would not receive these tokens; current customer routes are checked individually in the existing UI-system contract test.

## Task 1: compatible token foundation
- Added `scripts/test-customer-app-design-tokens.mjs` first.
- RED evidence: test run against the pre-token shared stylesheet fixture failed with the expected `missing design token --dw-color-brand`.
- Added 65 design-token declarations across semantic colour, typography, spacing, radii, shadows, motion and z-index layers.
- GREEN evidence: test run against the post-token fixture passed. Equivalent assertions against the exact current branch CSS and legacy stylesheet content passed: 73 required declarations checked (includes repeated test references), all legacy radius/colour values preserved, all 14 compatibility aliases matched.
- Task 1: complete (commits `c6b4b98..11968ee`, tests: `node scripts/test-customer-app-design-tokens.mjs` → fixture RED→GREEN; direct branch-source assertions → pass).

## Task 2: shared customer UI foundation
- Added `scripts/test-customer-app-ui-contract.mjs` before the route-scope/token application change.
- RED evidence: test run against the pre-change shared stylesheet fixture failed on missing Profile/Legal route scope.
- Added token-aware shared styling for all customer route classes, including Profile and Legal, plus shared input typography/accent colour and consistent primary action typography/transition timing.
- GREEN evidence: the focused Node test passed on the source-shaped local fixture. The same route scope, token-use, reduced-motion, focus, safe-area, overflow and seven-navigation destination assertions passed against the current branch source fetched from GitHub.
- Added both contract tests to `.github/workflows/static-validation.yml`. CI will be authoritative once a draft PR is opened; no CI result is claimed yet.
- Task 2: complete (commit `d4c37f9` plus workflow/test integration below; local fixture test → pass; exact branch source assertions → pass).

## Task 3: premium mobile navigation
- Added `scripts/test-customer-nav-visual-contract.mjs` before changing the navigation style string.
- RED evidence: test run against the previous navigation style fixture failed on the missing shared z-index token.
- Updated only the existing injected mobile navigation styles: centered max-width glass surface, 78px container, 64px tabs with a 44px minimum target, larger labels, token-based active/cart states, safe-area spacing, preserved badge behaviour and reduced-motion support.
- The seven navigation keys, cart count/localStorage behaviour, routing paths, initial view handling and aria-current logic were not changed.
- A template-string delimiter issue was caught during source verification and corrected before marking the task complete. Full `node --check customer-nav.js` remains pending GitHub Actions CI.
- Task 3: implementation complete pending CI (commit `3eef388`; branch-source contract checks → pass).

## Tasks 5 and 6: shopping journey and account/support screen polish
- Added `scripts/test-customer-app-screen-polish.mjs` before the screen-level CSS updates.
- RED evidence: the focused Node contract run against the pre-screen-polish CSS fixture failed on the missing Profile shell styling contract.
- Added route-scoped visual refinement for Profile, Plans, Orders, Checkout, Notifications, Support and Legal, using the shared tokens for typography, surfaces, radii, spacing, borders and elevation.
- Mobile styles keep Profile's seven-destination bottom navigation clear, collapse its panels to one column, and preserve safe-area padding. Shopping forms and card surfaces retain their existing IDs and behaviour.
- No HTML runtime hooks, page scripts, payment code, order lifecycle, auth/session behaviour, database or policy files were changed in this slice.
- GREEN evidence: focused Node test passed on the source-shaped local fixture; exact route/style/hook assertions passed against the current branch HTML/CSS fetched from GitHub. Workflow CI result for this new test is pending the next push.
- Tasks 5 and 6: implementation complete pending CI (commit `d92cd82`; source checks → pass).

## Task 4: home and discovery visual refinement
- Added `scripts/test-customer-app-discovery-polish.mjs` first.
- RED evidence: test run against the pre-refinement shared stylesheet fixture failed with the expected missing `.home-page .hero` discovery rule.
- Added scoped shared-token styling for Home hero/category/provider cards/compare surfaces and for store identity/product detail/catalogue surfaces. Existing base layouts and route HTML were retained.
- Preserved all existing Home search/filter/sort/compare/cart hooks and store/product catalogue, map, quantity, add-to-cart and plan hooks.
- GREEN evidence: the focused Node contract passed against the source-shaped fixture after adding the targeted discovery rules. Exact current branch HTML/CSS source assertions passed for all required route hooks and seven style selectors.
- Added the new discovery contract to static-validation CI. New-head CI/preview run is pending.
- Task 4: implementation complete pending CI and visual preview (commit `ed58a47`; local fixture → pass; GitHub source assertions → pass).

## Account route coverage extension
- Extended the screen polish test to include the dedicated Personal Details route and the Sign in/Create Account route, including their existing account form, Google sign-in, phone OTP and password reset IDs.
- RED evidence: local fixture with Profile/Plans/Orders/Checkout/Notifications/Support/Legal styling already present failed exactly on missing `.details-page .details-shell`.
- Added route-scoped, token-based refinements to Personal Details and Auth surfaces. Personal detail form fields, account save controls, OTP forms and auth callbacks remain untouched.
- GREEN evidence: expanded screen contract passed on the source-shaped fixture after the two route selectors were added; exact GitHub branch source assertions confirmed all nine routes load the shared style layer, all nine visual scopes exist, and required Auth/Personal Details hooks are intact.
- Follow-up to Tasks 5/6: coverage expanded from seven routes to nine routes; no business/session code changed.
