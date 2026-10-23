# Doodhwala Supabase setup

## 1. Project status

The dedicated Doodhwala Supabase project is provisioned in `ap-south-1` and the marketplace migration has been applied successfully.

The schema source remains:

`supabase/migrations/20261007_doodhwala_marketplace.sql`

## 2. Configure the browser client

Open supabase-config.js and set:

window.DOODHWALA_SUPABASE_URL = "https://YOUR_PROJECT_REF.supabase.co";
window.DOODHWALA_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_...";

Only use the publishable key in the browser. Never put a secret/service-role key in this file.

The project should have RLS enabled exactly as defined by the migration.

## 3. Auth

The customer flow is available at /auth.html.

The current implementation supports:

- email/password sign up
- email/password sign in
- customer profile creation through the Auth trigger
- redirect back to checkout or provider onboarding

Supabase email confirmation may be required depending on the project's Auth settings.

## 4. Provider onboarding

/provider.html now attempts to sync to Supabase when a provider is authenticated.

Provider accounts are created with:

- provider profile
- service area
- delivery radius
- milk products
- pending verification state

A provider is not public marketplace inventory until its verification record is approved.

## 5. Customer discovery

The customer homepage calls find_nearby_providers(latitude, longitude, radius) when Supabase is configured.

The RPC returns:

- provider identity
- locality/city
- distance
- rating
- delivery window
- active milk products

The browser location is requested only when the customer asks to find nearby providers.

## 6. Checkout

/checkout.html handles:

1. authentication check
2. delivery address
3. cart review
4. provider grouping
5. atomic order creation

The checkout creates one order per provider when a cart contains products from multiple local sellers.

The create_order RPC validates the provider, address ownership and product availability, and reads the product price from the database rather than trusting the browser's displayed price.

Direct seller UPI + Cash on Delivery are implemented as an MVP: seller-owned UPI instructions, order-scoped customer retrieval, UPI intent/QR checkout, and manual seller attestation. This does not verify bank settlement or provide an automated payment gateway. See [DIRECT_UPI_PAYMENT_FLOW.md](./DIRECT_UPI_PAYMENT_FLOW.md).

### Payment control deployment status

Do not assume the direct-UPI/payment-intent code in the repository has been installed in Supabase. The connected Doodhwala project audit on 2026-10-23 found no payment migrations from `20261022120000` onward, no direct UPI/payment ledger tables or RPCs, and no deployed `doodhwala-pay` Edge Function. Apply the payment migrations in order in an isolated staging project and verify the corrected foreign-key/schema contracts before production. See [PAYMENT_SECURITY_READINESS.md](./PAYMENT_SECURITY_READINESS.md). The readiness RPC now makes checkout fail closed when required payment controls are missing, but that guard itself must be deployed with the final payment-controls migration.

## 7. Provider verification

New providers are automatically created with provider_verifications.status = 'pending'.

Only approved providers and their active products are publicly discoverable.

The verification table is designed so provider self-registration cannot grant itself an approved status.

## 8. Security model

- RLS is enabled on exposed tables.
- Browser code uses only the publishable key.
- Ownership checks use auth.uid().
- Authorization does not depend on editable user metadata.
- The atomic order RPC is isolated in a private schema and checks auth.uid() before doing privileged order creation.
- Provider approval checks use a private helper rather than recursive RLS queries.

## Current limitation

The backend is provisioned, but production readiness must be re-verified. Provider approval gates public inventory. Direct seller UPI/COD source flows exist, but migration deployment and end-to-end payment behavior are not confirmed by this document. There is not yet an admin approval UI or verified automated bank/PSP payment confirmation. Recurring subscriptions and live order-status notifications require separate release verification.
