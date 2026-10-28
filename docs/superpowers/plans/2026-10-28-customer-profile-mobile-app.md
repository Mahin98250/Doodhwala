# Customer Profile & App-Style Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a dedicated customer Profile screen and make Doodhwala's navigation feel like a mobile marketplace app rather than a long website footer.

**Architecture:** Use static HTML/CSS plus a small session-aware JavaScript module consistent with the existing GitHub Pages app. Keep six mobile nav slots by moving Saved into Profile, use existing legal/support/order routes, and precache the new page in the service worker.

**Tech Stack:** HTML, CSS, vanilla JavaScript, existing Supabase Auth, Node.js assertion-based regression tests, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-28-customer-profile-mobile-app.md`

## Global Constraints
- Preserve existing order, subscription, payment, seller, database, and authorization logic.
- Keep all internal links rooted at `/Doodhwala/` for GitHub Pages.
- Keep legal policy draft warnings visible.
- Keep the six-item mobile navigation and current cart count behavior.
- Respect reduced motion, keyboard focus, and mobile safe-area insets.

## Review Focus
- Signed-out users can open Profile and browse legal/support links.
- Supabase session errors do not crash the page or display invented identity data.
- Sign-out is local-scope only and does not affect other devices.
- Saved Sellers still opens the existing saved-provider view.
- All new profile assets resolve in clean and legacy routes and offline cache.

## Tasks
- [x] Add responsive Profile page, session-aware identity, and account/legal shortcuts.
- [x] Update mobile/desktop navigation and move the home footer's policy list into Profile.
- [x] Add profile routes/assets to the PWA precache and advance the cache revision.
- [ ] Run static, site asset, service worker, offline, and profile regression checks; review the final diff and open a PR.