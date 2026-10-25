# Doodhwala staging and production testing runbook

## Environment safety rules

- `main` is the production release branch unless the team explicitly documents a different protected production branch.
- Feature branches and pull requests are for isolated development and review.
- The staging integration branch/environment is the acceptance-test gate. Do not merge unreviewed changes directly into production.
- Keep separate Supabase projects, authentication settings, storage buckets, OAuth callback URLs, secrets, and payment credentials for staging and production.
- Vercel Preview deployments are not automatically a safe staging environment: verify the branch-specific environment variables and Supabase project URL before using the preview for authenticated or write tests.
- Never place a Supabase service-role key in browser code or any `NEXT_PUBLIC_*` variable.
- Use synthetic accounts, addresses, products, and orders in staging. Do not copy production customer data into staging.
- Use COD or provider-supported sandbox/test payment flows in staging. Never initiate real UPI transfers as a test.
- Database changes must be committed as migrations, applied and verified on staging first, and promoted to production only in a reviewed release. Do not make undocumented manual production schema changes.
- Do not merge migration/security PRs until the acceptance gates below pass. A green frontend build alone is not evidence that checkout works.

## Suggested branch and deployment model

1. Create short-lived feature/fix branches from the agreed integration baseline.
2. Open a pull request into the staging integration branch; require lint, type-check, unit tests, migration checks, and build checks.
3. Deploy that exact commit to the staging environment with staging-only secrets.
4. Run automated integration tests and the manual acceptance checklist below.
5. Fix failures on the feature branch and repeat staging tests.
6. After approval, promote the same reviewed commit through a production pull request/release. Recheck migrations and production environment bindings before deployment.
7. Keep production rollback instructions and a known-good deployment available. Database rollback must be planned separately; prefer forward-fix migrations for destructive/data-changing schema changes.

Do not create or repoint a branch from an unmerged PR simply to make the branch names look right. First agree on the integration baseline, then create the staging branch from that baseline.

## Pre-test environment gate

- [ ] Confirm the deployed commit SHA and branch.
- [ ] Confirm the staging deployment uses the staging Supabase project URL and publishable/anon key.
- [ ] Confirm no service-role key or production secret is bundled into client-side assets.
- [ ] Confirm Google OAuth and phone OTP callback URLs point to staging and test credentials.
- [ ] Confirm payment integrations are sandbox/test-only or disabled; COD is available for checkout tests.
- [ ] Confirm storage and email/SMS providers cannot send unintended real customer communications.
- [ ] Confirm the staging database migration history matches the migrations committed in the branch.
- [ ] Record a baseline for security and performance advisors before testing.
- [ ] Confirm test data can be safely reset without affecting production.

## Customer acceptance tests

- [ ] Sign up and sign in with email/password.
- [ ] Google OAuth success, cancel, and error paths.
- [ ] Phone OTP success, wrong OTP, expired OTP, resend cooldown, and rate limiting.
- [ ] Password reset and session sign-out/expiry.
- [ ] Complete/edit profile and manage saved addresses/items.
- [ ] Product list, availability, price, quantity validation, and out-of-service-area behavior.
- [ ] Cart survives refresh where expected and recalculates totals from server-authoritative prices.
- [ ] Place a COD order with a valid cart and address.
- [ ] Double-click/retry checkout with the same idempotency key; exactly one order must be created.
- [ ] Reuse an idempotency key with a different payload; request must fail safely.
- [ ] Empty cart, invalid product, inactive seller, insufficient capacity, and invalid address are rejected.
- [ ] Order history shows only the signed-in customer's orders.
- [ ] Customer cancellation succeeds only in allowed statuses and records a reason/event.
- [ ] Subscription create, edit, pause, resume, skip, and next-delivery scheduling.
- [ ] Promo code valid, expired, usage limit, minimum cart, and tampered discount cases.

## Seller and delivery acceptance tests

- [ ] Seller sign-in and authorization for the correct seller account.
- [ ] Create/edit/deactivate products; validate prices, stock, and quantities.
- [ ] New order appears only to the owning seller.
- [ ] Accept/reject order; rejection requires a reason.
- [ ] Valid status progression works; invalid status jumps are rejected.
- [ ] Concurrent seller actions do not duplicate or corrupt order state.
- [ ] Delivery tracking events are written only through a trusted server/RPC path.
- [ ] Customer can see tracking events only for their own order.
- [ ] Seller can see tracking events only for orders assigned to their seller identity.
- [ ] A customer or seller cannot insert arbitrary tracking locations/statuses or view another party's data.
- [ ] Delivery completion and cancellation create the expected audit history.

## Owner/admin acceptance tests

- [ ] Non-admin user cannot open admin pages or invoke admin RPCs directly.
- [ ] Allowlisted admin can access authorized admin operations.
- [ ] Admin list, seller moderation, order oversight, and analytics are scoped correctly.
- [ ] Client-side route hiding is not treated as authorization; direct API/RPC attempts are tested too.
- [ ] Admin actions are audited and sensitive fields are not exposed to normal users.

## Security and reliability tests

- [ ] RLS and grants are checked for each customer-facing table.
- [ ] Cross-customer and cross-seller IDOR tests fail closed.
- [ ] Anonymous callers cannot invoke authenticated order/admin functions.
- [ ] Order money/customer-owned fields cannot be modified through direct table updates.
- [ ] Rate limits cover OTP, login, reset, promo validation, and order creation.
- [ ] Error reporting accepts only intended fields and cannot be used to expose secrets or spam the database.
- [ ] Supabase security advisor findings are reviewed; intentional no-policy tables are documented as service-only.
- [ ] No secret keys, OTPs, payment credentials, or full sensitive addresses appear in logs.
- [ ] Basic mobile viewport, keyboard, loading, empty, error, and offline states are checked.

## Performance and regression tests

- [ ] Run a small smoke test after every staging deploy.
- [ ] Test realistic concurrent browsing and checkout using synthetic accounts; ramp load gradually.
- [ ] Record p50/p95 response times, error rate, database CPU/connections, and slow queries.
- [ ] Test duplicate checkout requests and simultaneous orders for the same seller/capacity.
- [ ] Check indexes for the actual order-history and seller-queue queries.
- [ ] Verify error rate and latency return to baseline after load stops.
- [ ] Do not run destructive or high-volume load tests against production.

## Release gates

A release is eligible for production only when all are true:

1. CI lint, type-check, tests, and production build pass.
2. The deployed staging commit is identified and matches the reviewed commit.
3. Customer, seller, delivery, admin, and security acceptance tests pass.
4. Order idempotency and cross-user authorization tests pass.
5. Staging migration history and schema are reconciled.
6. Required security advisor findings are resolved or documented with an explicit risk acceptance.
7. Production secrets/project binding is independently verified.
8. Rollback/forward-fix plan and release notes are ready.
9. A human approves the production release.

## Current staging notes (2026-10-25)

- Security PR #61 remains draft and unmerged: https://github.com/Mahin98250/Doodhwala/pull/61
- The latest preview deployment for commit `c512d303f7edc56ddac531747aeaa0f68ca731fa` reached Vercel `READY`: https://doodhwala-next-preview-eintluyph-patelmahin140-4489s-projects.vercel.app
- Vercel environment-variable metadata could not be inspected by the connected integration (403), so the preview's staging-only Supabase binding is not yet verified. Do not treat it as a fully validated staging environment until an authorized project owner confirms the binding.
- Staging-only database hardening and legacy order-overload removal were applied and verified on the Doodhwala Staging Supabase project. Production was not modified.
- Security advisor still reports RLS-enabled/no-policy informational findings for `private.admin_allowlist`, `public.client_error_reports`, and `public.delivery_tracking_events`. These are currently deny-by-default/service-only; test the trusted application paths before adding narrowly scoped policies.
- The frontend build being READY does not mean the end-to-end order workflow has passed. Record test results with pass/fail, commit SHA, environment, and evidence before promoting.
