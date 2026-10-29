# DW-002 customer journey interaction checks

**Date:** 2026-10-28  
**Branch:** `vaidik/dw-002-ui-ux-audit-current-main`  
**Environment:** Isolated local static site + headless Chromium; external network requests are blocked.

## Reproducible automated checks

| Check | Route / viewport | Steps | Expected result | Evidence boundary |
|---|---|---|---|---|
| Responsive home | `/Doodhwala/`; 320, 390, 768, 1024, 1440px | Load and capture screenshot at each width | Mobile nav only on mobile widths, accessible search name, no horizontal overflow, no uncaught page errors | Browser-emulated viewport only |
| In-page navigation | `/Doodhwala/`; 390px | Tap Explore → Saved → Home | `aria-current="page"` and active styling follow each selected view | Local UI state only; no backend needed |
| Route layout | Checkout, Auth, Plans, Orders, Product, Support, Provider | Open at 390px and 1440px | HTTP success and no horizontal overflow | Does not prove authenticated/backend states |
| Search and discovery | Home | Focus/type a query; inspect accessible name | Search accepts text and has an explicit accessible name | Correctness of live search results not tested; external APIs blocked |
| Cart and checkout safety | Checkout | Open signed-out checkout; inspect required controls, stop before final submit | Required fields and sign-in gate remain present; no order submitted | Source contracts; not a staging order test |

## Manual checks still required

1. With approved demo fixtures, verify product identity/price, increment/decrement/remove behavior, subtotal/total, and cart persistence.
2. Walk all provider onboarding steps with valid and invalid values; verify errors and step progression. Do not save to production.
3. Test desktop sidebar and all seven mobile navigation destinations on real browsers, including cart badge changes and deep links.
4. Test keyboard focus order, focus visibility, touch-target size, screen-reader names/announcements, and reduced motion.
5. Use an authorized isolated staging project and synthetic test accounts to verify search/filter results, auth error recovery, checkout → provider queue → order tracking, duplicate-submit protection, and loading/empty/error states.
6. Repeat on physical Android and iOS devices where available.

No physical-device, real-authentication, real-order, payment, production, or authenticated staging test is claimed by this audit.
