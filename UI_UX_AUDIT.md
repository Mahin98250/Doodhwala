# DW-002 — Responsive UI and core interaction audit

**Date:** 2026-10-28  
**Branch:** `vaidik/dw-002-ui-ux-audit-current-main`  
**Target:** `/Doodhwala/` and customer/provider routes  
**Evidence boundary:** Source inspection plus isolated Chromium smoke tests in CI. No real authentication, customer data, orders, payment, production writes, or staging credentials are used.

## Findings fixed in this branch

### UX-001 — Primary mobile navigation labels are too small
- **Severity:** Medium (readability/accessibility).
- **Route:** `/Doodhwala/` and pages mounting `customer-nav.js`.
- **Viewport/device:** Mobile width 320–360 CSS px; browser-emulated viewport (not a physical device).
- **Steps:** Open the customer page at 320px or 360px wide and inspect the fixed seven-item bottom navigation.
- **Expected:** Primary destination labels are readable without zooming and remain within their navigation item.
- **Actual before fix:** Source styles used 7.5px labels, reduced to 7px at widths up to 360px.
- **Fix:** Increase labels to 9px and 8.5px at the smallest breakpoint. Chromium checks cover navigation visibility and horizontal overflow; physical-device readability/touch targets remain unverified.

### UX-002 — Active navigation did not track in-page Home/Explore/Saved changes
- **Severity:** Medium (navigation feedback/accessibility).
- **Route:** `/Doodhwala/`, mobile bottom navigation.
- **Viewport/device:** 390px Chromium viewport; repeat manually on mobile.
- **Steps:** Tap Explore, then Saved, then Home without navigating to another URL.
- **Expected:** The active highlight and `aria-current="page"` match the visible in-page view.
- **Actual before fix:** `navigateHomeView()` changed the marketplace view but did not notify `customer-nav.js`, whose active state was URL-derived.
- **Fix:** Dispatch `doodhwala:view-changed` after an in-page view change and have shared navigation refresh its active state. Regression test covers Explore → Saved → Home.

### UX-003 — Marketplace search input lacked a programmatic accessible name
- **Severity:** Medium (accessibility).
- **Route:** `/Doodhwala/`, search input `#search`.
- **Viewport/device:** Desktop and mobile Chromium viewports.
- **Steps:** Inspect the input's accessible name or navigate to it with assistive technology.
- **Expected:** The search field has a stable accessible name independent of placeholder-only support.
- **Actual before fix:** The input had a placeholder but no `aria-label`/label association.
- **Fix:** Add `aria-label="Search milk, provider or area"`. Automated test checks the attribute; screen-reader verification remains manual.

## Route and state verification matrix

| Area | Route | Viewport/device | Steps | Expected | Current evidence / severity |
|---|---|---|---|---|---|
| Primary navigation | `/` | 320, 390, 768, 1024, 1440 CSS px | Load page; inspect nav visibility, activate Explore/Saved/Home | Mobile nav visible only on mobile; correct active item; no horizontal overflow | Automated Chromium check; any broken destination is High |
| Search | `/` | Mobile + desktop emulation | Focus and type into search | Programmatic name exists; input accepts text; results/no-results/error recovery are explained | Name and input wiring source/browser checked; live search correctness not verified because external APIs are blocked; High if wrong sellers/prices appear |
| Loading/error/empty | `/` | Mobile + desktop emulation | Load with backend unavailable; inspect provider grid and retry/no-results controls | Loading is distinguishable from error; error offers retry; empty filtered results offer recovery; demo data is not presented as live | Source contracts and isolated smoke only; backend-state behavior against authorized fixtures remains unverified; High |
| Cart/checkout | `/Doodhwala/checkout/` | 390 and 1440 CSS px | Open route signed out; inspect required fields; do not submit an order | Clear sign-in/validation state; no false success or duplicate submission | Route layout smoke + source contracts; quantity/total correctness and staging order journey not run; Critical if contents or totals diverge |
| Authentication | `/Doodhwala/auth/` | 390 and 1440 CSS px | Inspect blank/invalid form validation; do not sign in | Invalid fields are rejected and errors recoverable | Layout/source contracts only in this refreshed branch; real auth requests not run; High |
| Plans and orders | `/Doodhwala/plans/`, `/Doodhwala/orders/` | 390 and 1440 CSS px | Open route and inspect layout/loading/empty/error copy | Route loads without horizontal overflow and communicates its state | Chromium layout smoke; account-backed data state not verified; High |
| Provider onboarding | `/Doodhwala/provider.html` | 390 and 1440 CSS px | Inspect each onboarding step and required-field prompts without saving production data | Required fields and step progression are clear | Route layout smoke only; full step-by-step valid/invalid submission remains NOT RUN; High |
| Keyboard, screen reader, touch | Customer and provider routes | Physical Android/iOS and desktop keyboard/screen reader | Tab through controls, inspect focus order and target sizes, read with screen reader | Visible focus, usable touch targets, meaningful names/announcements | NOT RUN; requires manual assistive-technology/device review |

## Safety and limitations
- Browser tests use localhost with external requests blocked; no live provider search, authentication, payment, or order submission is performed.
- Screenshots are generated by the CI browser workflow as artifacts, not represented as physical-device screenshots.
- Do not treat browser viewport emulation as physical Android/iOS verification.
- Do not mark DW-002 DONE until Mahin reviews and accepts the PR and the remaining manual/device checks are either completed with evidence or explicitly accepted as follow-up work.
