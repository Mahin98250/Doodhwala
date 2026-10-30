# Doodhwala — Complete Customer App UI Upgrade

**Project:** Doodhwala  
**Initiative:** Customer Experience 10X  
**Status:** Approved by project owner on 2026-10-30  
**Scope:** All customer-facing screens

## 1. Vision
Transform Doodhwala from a collection of website-like pages into a consistent, premium, mobile-first local milk marketplace. Combine the simplicity and visual quality of Apple's interfaces, the convenience of modern grocery shopping apps, and Doodhwala's green-and-white dairy identity. Improve usability, not merely colours and animations.

## 2. Goals
1. Establish one shared visual design system.
2. Make customer screens feel like one application.
3. Improve mobile navigation and screen layouts.
4. Make shopping, ordering and recurring plans easier to understand.
5. Standardize typography, spacing, cards, buttons, forms and feedback.
6. Improve accessibility, loading performance and responsive behaviour.
7. Preserve existing customer functionality and real marketplace data.
8. Add regression tests for important UI and interaction contracts.

## 3. Screens in scope
- Shopping/discovery: Home, Explore/nearby providers, search and filters, provider storefront, milk product detail, saved providers.
- Shopping journey: Cart, Checkout, order confirmation/history, recurring milk plans, subscription schedule and plan management.
- Customer account: Profile, personal details, notifications, Support, Privacy Policy, Terms, cancellation/refund information and other legal information.

## 4. Shared design system
Create consistent foundations for brand and semantic colours, typography, spacing, layout, radii, elevation, cards, buttons, inputs/forms, navigation, headers, dialogs/drawers, notifications, loading/empty/success/error states, responsive breakpoints, animation, reduced-motion behaviour, focus and accessible controls.

## 5. Navigation
Retain the existing seven customer destinations: Home, Explore, Plans, Orders, Saved, Cart and Profile. Navigation must be consistent, responsive and easy to use one-handed on mobile. Desktop navigation must adapt without duplicating mobile controls.

## 6. Interaction quality
Every interactive element must have a clear purpose and working behaviour. Preserve pressed, active, disabled and focus states; useful loading and error feedback; confirmation for important actions; accessible labels and keyboard navigation; useful empty states; and truthful data. Never fabricate reviews, prices, seller details or delivery claims.

## 7. Technical approach
Preserve the current HTML, CSS and vanilla JavaScript architecture. Build on existing application modules and shared styles. Avoid adding a framework or paid dependency for visual improvements alone. Prefer small, scoped changes and gradual migration over rewriting the application.

## 8. Non-goals and safety boundaries
- No payment gateway or checkout business-logic changes.
- No payment collection changes or real transactions.
- No Supabase schema, migration, RPC or RLS changes.
- No authentication or authorization policy changes.
- No order lifecycle or seller business-rule changes.
- No provider/admin dashboard redesign in this phase.
- No production deployment or production-data changes.
- No merging or modifying existing open pull requests as part of this initiative.

## 9. Approaches considered
**Selected — Complete customer-app redesign:** unify all customer screens through one design system and a coordinated screen-by-screen migration. Strong long-term consistency without requiring a risky framework migration.

**Homepage/discovery first:** faster initial visual change, but leaves Profile, Checkout, Orders and Plans inconsistent.

**Frontend architecture migration:** larger technical change and extra regression risk, unnecessary for the immediate visual goals.

## 10. Implementation phases
1. Foundations: audit existing UI ownership; establish tokens, typography, spacing, surfaces and interaction rules.
2. Navigation/app shell: unify customer navigation, headers, responsive structure and shared feedback components.
3. Shopping experience: Home, Explore, provider cards, stores and product pages.
4. Shopping journey: Cart, Checkout, Orders and recurring Plans, preserving business logic.
5. Account experience: Profile, personal details, notifications, Support and Legal pages.
6. Quality assurance: regression coverage, responsive visual checks, navigation and interaction verification.

## 11. Quality gates
- Existing UI and route contracts remain intact.
- No missing customer navigation destinations or broken customer actions.
- No fabricated prices, ratings or delivery information.
- No horizontal overflow on narrow mobile widths.
- Responsive checks for mobile, tablet and desktop.
- Keyboard focus and reduced-motion support.
- Existing tests and new relevant regression tests pass.
- Preview visual review before merge discussion.

## 12. Builder decisions
Use the current repository architecture, existing dependencies, real marketplace data and existing working integrations. Work on an isolated feature branch. Keep changes reviewable. Do not merge or deploy to production without explicit approval.
