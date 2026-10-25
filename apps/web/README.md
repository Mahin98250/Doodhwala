# Doodhwala Next.js application

This app lives under apps/web and is being migrated incrementally from the existing HTML/CSS/JavaScript marketplace. It uses Next.js App Router, React, TypeScript and the existing Supabase backend. The root legacy app remains untouched by the migration branch.

## Local setup

1. Install Node.js 22 or newer.
2. Copy .env.example to .env.local.
3. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to the public browser-safe Supabase project values. Do not put a service-role or secret key in any NEXT_PUBLIC_* variable.
4. Run npm ci, then npm run dev from this directory.

Validation commands:

    npm test
    npm run typecheck
    npm run build
    npm run smoke

## Migrated route groups in this draft

| Route | Purpose |
| --- | --- |
| /, /providers, /stores/[providerId], /products/[productId] | Home, live provider discovery and seller/product catalogue |
| /saved, /account | Local saved products and seller favourites; profile and addresses |
| /auth/sign-in, /auth/sign-up, /auth/reset-password | Email/password, Google OAuth entry, phone OTP and password recovery |
| /cart, /checkout | Browser-persisted cart, addresses, promo preview, seller-grouped orders, COD and direct seller UPI |
| /orders, /orders/[orderId] | Customer order history, status timeline, cancellation, rating, reorder and direct-UPI instructions |
| /subscriptions, /subscriptions/[subscriptionId] | Create, edit, pause/resume, cancel and skip a delivery |
| /seller, /seller/products, /seller/deliveries | Provider profile, catalogue and store status, UPI settings, order queue, recurring route and COD/UPI receipt actions |
| /owner | Admin overview and report range, provider/product moderation, orders, support, customer/subscription details, audit and error-report views |
| /support, /legal, /offline | Customer tickets and ticket history, marketplace information and offline recovery |
| Legacy .html aliases | Rewrites for former paths including /Doodhwala/auth.html, checkout/orders/plans/provider/admin/support/store/product/legal/offline pages |

The route matrix and legacy RPC inventory live in ../../docs/LEGACY_ROUTE_FLOW_INVENTORY.md. This is a feature migration, not a schema migration. The UI uses existing RPCs and user-scoped tables instead of creating parallel data models.

## Authentication provider configuration

The preview origin must be configured in Supabase Authentication's allowed redirect URL list. Google OAuth requires the Google provider and callback configuration to be enabled. Phone sign-in requires SMS/OTP to be enabled with suitable rate limits/provider configuration. These project settings cannot be validated by a static build and have intentionally not been changed by this branch.

## Security boundaries

- The browser only receives the publishable/anon key. The client refuses known Supabase secret/service-role key shapes.
- Session identity comes from Supabase Auth, but roles and access must be enforced by existing RPCs/RLS; client-rendered hiding is not an authorization boundary.
- Order product IDs, prices, delivery coverage, promo eligibility, idempotency and payment method readiness must be checked by the backend when order creation occurs.
- Direct UPI hands off to the seller's payee URI. Opening a UPI app is not payment proof; only the seller confirmation flow changes recorded receipt status. COD is likewise recorded by the seller.
- Saved products and provider favourites are stored locally in the current browser, not synced between devices.
- Precise location is only requested after the user presses the relevant button. Sellers can explicitly share a business location to set a delivery area.
- No SQL migrations, production data changes, auth settings, payment configuration, or production-domain cutover are part of this PR.

## Verification still required before launch

Automated checks prove route rendering, compilation and pure helper behavior; they do not prove that live Supabase grants/RLS allow every intended operation, nor that Google/SMS works on the preview host. Before cutover, configure the preview, run real customer/provider/owner browser journeys using test accounts and non-production order data, validate mobile behaviour and keyboard accessibility, inspect the actual backend RPC response shapes, and rehearse rollback. This pull request should remain draft until those gates pass.
