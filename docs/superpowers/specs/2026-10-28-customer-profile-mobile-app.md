# Doodhwala Customer Profile & Mobile-App Navigation — Design Spec

## Goal
Give Doodhwala a real app-style customer Profile destination that centralizes account access, customer shortcuts, support, and legal/privacy information instead of relying on a long website footer.

## User and problem
Customers use Doodhwala for local milk discovery, orders, and recurring plans. The current six-slot mobile navigation has Home, Explore, Plans, Orders, Saved, and Cart, while legal/support links sit at the bottom of the home page. This feels like a website and leaves no dedicated place for account-level tasks.

## Design decision
Keep the existing six-slot navigation and replace the Saved slot with Profile. Move Saved sellers into Profile quick actions so saved discovery remains available without crowding the mobile navigation. The Profile screen uses a familiar grocery-app account pattern: an account identity card, four high-frequency shortcuts, grouped support/information links, and a privacy/legal section with direct links to existing legal document anchors.

## Blinkit comparison (inspiration, not copying)
Public Blinkit app UX teardown material describes a Profile/Your account screen with account identity, quick access to support, order history, address book, notification preferences, account privacy, and logout. Blinkit's public legal pages separately expose privacy policy and terms. Doodhwala adapts the information hierarchy and compact account list pattern while retaining its own green/lime dairy brand, local-seller marketplace model, direct-seller fulfilment, and existing legal draft warnings. No Blinkit branding, assets, or proprietary copy will be copied.

## Scope
- Add clean `/profile/` and legacy `/profile.html` customer routes.
- Add account status display from the existing Supabase session; keep guest browsing available and use local-scope sign-out only.
- Put My Orders, Milk Plans, Saved Sellers, Updates, Support, Seller entry, About, Privacy Policy, Terms, Cancellations & Refunds, Seller Agreement, Complaints/Grievance, Data Rights, and Security links in Profile.
- Replace the home footer's long legal link list with a compact Profile & policies link.
- Add Profile to desktop sidebar and mobile bottom navigation, preserving six mobile destinations and cart badge behavior.
- Precache profile assets and bump the service-worker cache.
- Add regression tests and CI workflow coverage.

## Non-goals and safety
- Do not change ordering, subscription, payment, seller, database, or authorization business logic.
- Do not invent an address-book/settings feature that the current app does not have.
- Do not remove the existing legal draft notice or present draft policies as final legal advice.
- Do not copy Blinkit branding or claim feature parity where Doodhwala does not have the feature.
- No production database migration or payment behavior change.