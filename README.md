# Doodhwala 🥛

**A local-first milk marketplace for independent milk providers.**

Doodhwala is designed around one clear rule: this is not a catalogue for Amul, Jain Dairy, or other large dairy brands. The supply side is made of neighbourhood milk sellers who can serve customers in their own delivery area.

## Product vision

Think of the convenience and discovery model of a food-delivery marketplace, but focused entirely on milk:

- Customers discover independent providers near their location.
- Providers publish their milk types, pricing, timings, availability and delivery area.
- Customers can order one-off milk or recurring daily plans.
- Trust, verification, ratings, delivery reliability and locality are core product features.
- The customer interface is intentionally adapted for mobile, tablet/laptop and desktop rather than simply scaling one layout.

## Phase 2 provider side ✅

The repository now includes a complete browser-only provider workflow at `/provider.html`:

- 3-step provider onboarding
- Provider identity, owner and phone capture
- Primary milk type selection
- Base locality, city, PIN and delivery radius
- Delivery time window
- First milk product setup
- Provider dashboard with profile progress and readiness KPIs
- Milk catalogue with add / edit / delete / activate / pause
- Product search and stock filtering
- Service-area editor with delivery radius and time window
- Provider profile and trust/verification centre
- Separate provider mobile navigation and desktop sidebar
- LocalStorage persistence for Phase 2 demo data

This phase is intentionally backend-free. It proves the provider experience before authentication, database, document verification and real orders are connected.

## Phase 3 + 4 backend foundation ✅

The repository now contains the real marketplace backend contract and customer auth/checkout integration:

- Supabase schema + RLS migration for customers, local providers, milk products, service areas, addresses, orders and order items
- Provider verification state that starts at pending and cannot be self-approved through normal provider permissions
- Private atomic order-creation function that validates ownership, provider availability, product availability and database pricing
- Distance-aware provider discovery RPC using latitude/longitude + Haversine distance
- Supabase browser client configuration with the publishable key only
- Customer email/password authentication flow
- Provider console sync to Supabase when an authenticated provider is connected
- Delivery address capture
- Multi-provider cart grouping into separate provider orders
- Checkout → order creation flow
- Setup instructions in SUPABASE_SETUP.md

The Doodhwala Supabase project is provisioned and the production browser client is connected with the publishable key. Public provider inventory still requires provider onboarding plus approval.

## First MVP in this repository

- Doodhwala customer home/explore experience
- Local provider discovery cards
- Cow / buffalo / A2 / subscription filters
- Search by provider, area and milk type
- Functional cart with quantity controls
- LocalStorage cart persistence
- Desktop sidebar navigation
- Mobile bottom navigation
- Responsive layout with device-specific interaction patterns
- PWA manifest + offline service worker
- Doodhwala logo and brand foundation

The current provider listings are **demo data** for UI/product development and are not claims about real businesses.

## Product architecture planned next

### Customer
Account → location/address → nearby provider feed → provider page → product selection → cart → checkout → live order status → subscriptions → ratings

### Local provider
Provider signup → identity/business verification → service area → milk catalogue → price/availability → delivery schedule → incoming orders → route/delivery status → earnings

### Doodhwala operations
Provider moderation → verification → service-area management → disputes/support → marketplace analytics → fraud/safety controls

## Recommended backend direction

Supabase is a strong next step for the MVP because it can cover:

- PostgreSQL database
- Customer/provider authentication
- Row Level Security
- Storage for provider photos/documents
- Realtime order status
- Edge Functions for server-side operations

The current frontend is intentionally static-first so the product experience can be tested before introducing backend complexity.

## Suggested data model

Users, provider_profiles, provider_service_areas, milk_products, product_prices, delivery_slots, orders, order_items, subscriptions, addresses, reviews, provider_documents, notifications.

## Important marketplace rule

The production system should enforce a provider policy at onboarding/admin level so large packaged dairy brands cannot simply sign up as ordinary local providers. Doodhwala is intended to serve genuine independent/local milk sellers.

## Development phases

1. Customer MVP and responsive UX ✅
2. Provider onboarding + provider dashboard ✅
3. Supabase schema + Auth + RLS ✅
4. Location-aware provider discovery ✅
5. Product catalogue + availability ✅
6. Cart → address → checkout ✅
7. Orders + notifications
8. Recurring milk subscriptions
9. Payments
10. Verification, ratings, support and admin
11. Production hardening + analytics

## Local development

This first build is plain HTML/CSS/JavaScript and can be served by any static web server. It can also be deployed as a static site and installed as a PWA.

## P0 order journey verification (release gate)

The core journey is: **customer checkout → provider order queue → provider status changes → customer tracking**. Use this checklist in an isolated staging Supabase project with authorized test accounts. **Do not create synthetic customer/order records in production to test reporting.** If staging is unavailable, wait for a genuine, agreed order rather than manufacturing a live order.

### Pre-flight

- Confirm a customer account and an approved provider account belong to the same staging project.
- Confirm the provider is approved, available, has service coverage for the selected delivery pin, and has an available backend-linked milk product.
- Confirm the browser client contains only the Supabase publishable key; never put the service-role key in the static site.
- Use a phone-sized browser viewport, then repeat on an installed PWA after the latest service worker activates.

### Customer checks

1. Sign in and open checkout from a real backend-linked product in the provider's catalogue.
2. Load an existing delivery address, edit it, save it, and verify that the existing address is updated rather than duplicated.
3. Set or verify the delivery pin; confirm invalid/out-of-range coordinates are not used.
4. Submit once. Confirm the UI prevents double-submission and the order appears exactly once in the customer order history.
5. Confirm the success screen's **Track my order** link opens order history. Leave that page open: status should update through Realtime, and the visible-page fallback should refresh within about 60 seconds if an event is missed.
6. Reload the page and verify the order and latest status remain correct. Test a transient network failure only in staging and verify retry does not create a duplicate order.

### Provider checks

1. Open the provider dashboard for the matching account. The incoming order should appear in the order queue; wait for Realtime, then for the fallback refresh if needed.
2. Accept the order and move it through the allowed workflow: packing → ready → out for delivery → delivered.
3. Verify each change appears on the customer's order history and timeline. Check that a stale/expired order cannot be accepted and that unauthorized accounts cannot change the order.
4. Confirm queue totals change once per transition and no demo listing is presented as a live provider.

### P0 pass criteria

The journey passes only when the same order can be followed end-to-end by its real database ID, the customer and provider see consistent statuses after refresh/reconnect, retry is idempotent, address/pin data are correct, and the journey works on an actual mobile device. Static CI does **not** prove these account-, RLS-, Realtime-, permission-, GPS-, or device-level behaviours. Record any staging order ID and observed timestamps outside production analytics before calling P0 end-to-end complete.

---

## Project links

- **GitHub profile:** https://github.com/Mahin98250
- **Portfolio repository:** https://github.com/Mahin98250/Porfolio
- **More projects:** https://github.com/Mahin98250?tab=repositories

> Live demo links will be added only after the deployment URL is verified.

## Doodhwala Pay — foundation in progress

The payment foundation introduces a server-owned `payment_transactions` ledger and an authenticated `doodhwala-pay` Edge Function for idempotent payment-intent creation and customer-owned status lookup. Amounts are derived from the stored order total on the server and converted to integer paise.



### Payment security and release status

A read-only audit of the connected Doodhwala Supabase project found that the payment migrations and `doodhwala-pay` function are not deployed there yet. Direct seller UPI is not bank-verified, and the project is not approved for real-money/high-volume use. See [PAYMENT_SECURITY_READINESS.md](./PAYMENT_SECURITY_READINESS.md) for verified findings, hardening changes, and launch gates.

**Important launch boundary:** the automated `doodhwala-pay` gateway foundation is not live and does not collect or move money (`gateway_ready: false`, `money_moved: false`). Direct seller UPI is a separate manual-confirmation flow: money is intended to go from the customer's UPI app to the seller's UPI address, but Doodhwala cannot independently verify bank settlement. Automated collection/verification remains disabled until a suitable acquiring/payment provider or official merchant/bank integration is configured with server-side secrets, verified signed webhooks, replay protection, reconciliation, failure/refund handling, and required reviews. Never collect card numbers, CVV, UPI PINs, or banking passwords in Doodhwala. Never mark an order paid from a browser redirect or client callback alone.

Before enabling live collection:
1. Apply the reviewed SQL migration `20261022120000_doodhwala_pay_foundation.sql`.
2. Deploy `supabase/functions/doodhwala-pay` with JWT/session verification behavior tested against the production project.
3. Select a payment provider/acquirer and configure its credentials only as server-side secrets.
4. Implement provider-specific order creation, signed webhook verification, replay protection, reconciliation, refunds and idempotent state transitions.
5. Add sandbox and end-to-end tests for success, failure, cancellation, duplicate webhooks, partial refunds and amount mismatch.
6. Review applicable Indian payment, tax, privacy, marketplace and consumer-protection requirements with qualified professionals before production collection.

The current API explicitly reports `gateway_ready: false` and `money_moved: false`; an intent is not proof of payment.


## Branding asset contract

`assets/mascot.png` is the shared Doodhwala mascot for customer, seller, owner/admin, account, checkout, support, legal, and offline screens. The browser favicon and PWA manifest use the same asset. When changing the mascot, update this shared asset reference and the service-worker cache revision together so installed apps refresh reliably.
