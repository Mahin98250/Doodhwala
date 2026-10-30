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
