# Legacy route and flow inventory

**Baseline reviewed:** `main` at repository state checked on 25 October 2026.  
**Purpose:** a migration checklist for the Next.js work. This is an implementation inventory, not permission to retire the legacy pages.

## Route parity matrix

| Existing entry | Current responsibilities | Framework route target | Risk / migration gate |
| --- | --- | --- | --- |
| `index.html` | Provider discovery, location modal/map, filters, comparison, favourites, local cart and customer navigation | `/`, `/providers` | Medium. Discovery is already migrated read-only; saved sellers, comparison parity and cart are not. |
| `store.html?provider=...` | Seller public profile, active products, service-radius map and add-to-cart | `/stores/[providerId]` | Medium. Read-only public seller catalogue is migrated; do not add cart mutations until parity tests exist. |
| `product.html?provider=...&product=...` | Product details, seller availability, add-to-cart, daily-plan link | `/products/[productId]?provider=[providerId]` | Medium. Read-only detail is migrated; purchase/plan actions remain in legacy app. |
| `auth.html` | Sign-in, sign-up, Google OAuth, phone OTP, password reset, profile completion, role-aware redirects | `/auth/sign-in`, `/auth/sign-up`, `/auth/reset-password` | **High.** OAuth redirect allow-list, profile completion, session persistence and unauthorised-route tests required. |
| `checkout.html` | Address read/write, promo preview, per-seller order grouping, idempotency keys, payment readiness gates, COD/direct-UPI order placement | `/cart`, `/checkout` | **Critical.** Preserve price recalculation, idempotency, RLS ownership, payment gates and partial multi-seller failure behaviour. |
| `orders.html` | Order history/details, status events, cancellation, ratings, direct-UPI references/instructions | `/orders`, `/orders/[id]` | **Critical.** Customer isolation and payment evidence/state transitions require security regression tests. |
| `plans.html` | Milk subscription creation/update, pause, skip, product/address selection and delivery schedule | `/subscriptions`, `/subscriptions/[id]` | High. Subscription limits, schedule/capacity and ownership checks must remain database-authoritative. |
| `provider.html` | Seller onboarding/profile, service area, products, operating status, order dispatch/delivery lifecycle, COD and direct-UPI confirmation/settings | `/seller/*` | **Critical.** Every mutation requires server/database role and ownership checks; no client-only seller authorization. |
| `admin.html` | Owner/admin overview, provider moderation, provider/product controls, order/customer/subscription details | `/owner/*` | **Critical.** Require server-side role validation, least-privilege RPC access and auditable privileged operations. |
| `support.html` | Support ticket creation/history | `/support` | Medium. Preserve authenticated ownership and safe text handling. |
| `legal.html` | Legal and policy disclosures | `/legal` | Low to medium. Keep current policy content and links accurate. |
| `offline.html` | Offline/PWA fallback | `/offline` plus service-worker fallback | Medium. Validate caching, refresh and offline navigation during cutover. |

## Existing data-access contracts observed

The legacy app calls Supabase through a shared browser client that uses the project URL and a publishable/anon key. The new app must continue to enforce Row Level Security and must never use a service-role key in a browser component.

### Customer discovery and public catalogue

- `find_nearby_providers_v2` — provider search with optional coordinates and a bounded nearby radius. Current migration route: `/providers`.
- `get_provider_storefront` — public seller details, delivery-zone result and active/in-stock products. Current migration routes: `/stores/[providerId]`, `/products/[productId]?provider=[providerId]`.
- The existing SQL definitions use `SECURITY INVOKER` and explicitly grant execution to `anon` and `authenticated`. The function's grants and RLS must still be checked in a configured preview environment.

### Authentication and customer account

Observed auth APIs include password sign-in/sign-up, Google OAuth, phone OTP, reset-password, session retrieval/refresh, password update and sign-out. Existing application helpers also complete a customer profile and check admin access. The existing OAuth route uses the legacy GitHub Pages path; it must not be assumed to work unchanged on a new domain/host.

### Checkout and payments

Observed checkout RPC contracts include:

- `preview_promo_code`
- `customer_order_payment_controls_ready`
- `customer_check_provider_direct_upi`
- `customer_set_order_payment_method`

The current checkout performs address ownership checks, groups items by seller, validates backend-linked product IDs, gates order placement on payment-control readiness, checks direct-UPI setup per seller, and uses persisted idempotency keys. Direct-UPI is a direct seller payment flow; COD remains a supported option. Do not copy client-side order totals as authoritative and do not relax the current fail-closed behaviour.

### Orders and subscriptions

Observed order actions include `customer_cancel_order`, `submit_order_rating`, `customer_get_order_direct_upi` and tracking reads. Subscription mutations use `create_milk_subscription`, `update_milk_subscription`, `pause_milk_subscription` and `skip_milk_delivery`. Preserve ownership scoping, accepted state transitions, capacity constraints, rating constraints and audit/event writes.

### Seller and owner operations

Seller RPCs observed include `provider_get_dashboard`, `provider_upsert_own_profile`, `provider_get_own_profile`, `provider_set_store_status`, `provider_get_direct_upi_settings`, `provider_save_direct_upi`, `provider_get_subscriptions`, `provider_upsert_product`, `provider_delete_product`, `get_provider_dispatch_board`, `get_provider_delivery_route`, `provider_confirm_direct_upi_payment`, `provider_confirm_cod_collected` and `provider_update_order_status`.

Admin RPCs observed include `is_current_user_admin`, `get_admin_overview`, provider moderation/control operations, and scoped order/customer/subscription detail reads. Treat these operations as privileged until their grants and RLS/role checks are verified individually.

## Migration sequencing

1. **Completed in current draft PR:** isolated Next.js foundation, typed public catalogue models, unit tests, public browse/store/product routes, loading/error/not-found states, npm lockfile, reproducible CI install and production-route smoke tests.
2. **Next:** verify public RPCs in a configured preview, add browser-based accessibility checks, and compare mobile behaviour with the legacy app.
3. **Then:** migrate sign-in/profile-completion/session flows, with OAuth redirect configuration and unauthorized-access tests.
4. **Then:** migrate cart/order history/checkout only after duplicate-submit, price-tampering, seller-mixing, payment-readiness, direct-UPI, COD and RLS scenarios are covered.
5. **Finally:** migrate seller and owner consoles with server-verified roles and operation-level audit checks, then perform a controlled cutover/rollback rehearsal.

## Explicitly out of scope for the current PR

No production SQL migrations, production rows, RLS policies, auth provider settings, payment settlement rules, secret values or production deployment were changed. The current legacy app remains the source of truth for any flow not listed as already migrated.
