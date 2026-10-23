# Doodhwala payment security readiness review

**Review date:** 2026-10-23  
**Scope:** Repository payment migrations, checkout integration, direct-seller UPI flow, Doodhwala Pay Edge Function, and the connected Doodhwala Supabase project.  
**Status:** Security hardening in source is in progress. **Not approved for real-money launch or high-volume use.**

## Executive decision

Do not launch Doodhwala as a high-volume payment gateway yet. The existing source contains a direct-to-seller UPI instruction flow and a bookkeeping/payment-intent foundation, but neither is a verified payment acquiring/settlement system. For scale, use a suitably authorised acquiring bank/payment provider/marketplace product that supports seller onboarding and direct settlement to each seller's verified bank account. Doodhwala should orchestrate orders and reconcile server-verified provider events, not build a bank network or hold customer funds itself.

## Production checks performed

The connected Doodhwala Supabase project was checked read-only on 2026-10-23.

- The database is active on PostgreSQL 17.11. The marketplace `orders` and `provider_profiles` tables exist.
- The deployed migration history returned by Supabase ended at `20261013164921 doodhwala_revoke_provider_direct_writes`. The later payment migrations beginning `20261022120000` are **not applied** in that project.
- Read-only catalog checks confirmed that `provider_payment_settings`, `payment_transactions`, and `payment_provider_events` do not exist in the live database; neither do the direct-UPI payment-choice, settings, or seller-confirmation RPCs.
- The deployed Edge Function list contained `client-error-report`; `doodhwala-pay` was **not listed as deployed**.
- The Supabase security advisor reported leaked-password protection disabled. Enable and verify that control in Supabase Auth settings before launch: [Supabase password security guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- The security advisor also flagged RLS-enabled tables with no policies for `private.admin_allowlist` and `public.client_error_reports`. No policy can be intentional for server-only data, but grants, function boundaries and intended service-role-only access must be checked rather than blindly adding public policies.
- The performance advisor listed unused indexes. Do not remove them based on a small/early traffic sample without query-plan and production workload evidence.

These checks are a snapshot, not a certification or penetration test. Re-run them before release.

## Critical source issues addressed in this branch

1. **Payment ledger foreign key:** the original payment foundation referenced `public.providers`, but the current schema uses `public.provider_profiles` and has no `public.providers` table. The migration was corrected to reference the actual seller table before first deployment.
2. **Seller eligibility:** direct UPI can only be enabled by an active seller whose marketplace verification status is approved. Availability checks and payment-instruction retrieval also require an approved seller. This is seller/listing approval, not proof of ownership of the bank account or UPI address.
3. **Orphan-order prevention:** the checkout now calls an authenticated backend readiness RPC *before* creating any order. If payment-choice functions, payment columns, RLS, or database guards are missing/disabled, checkout fails closed, keeps the cart, and says no order was placed. This addresses the dangerous sequence where order creation could succeed but saving its payment choice could fail.
4. **PWA rollout:** the changed checkout runtime is versioned and added to the service-worker precache.
5. **Automated coverage:** contract tests cover the database-table reference, seller eligibility and fail-closed checkout sequence.

## Direct UPI is not an automated gateway

The direct UPI feature creates a UPI intent/QR from a seller-entered UPI ID. It does not verify that the UPI account belongs to the approved seller, does not query a bank's settlement system, and does not receive a trusted transaction webhook. A customer returning from a UPI app is not evidence of payment. A seller-confirmed status is a seller attestation, not an independently verified payment.

Do not use the current self-entered-identifier/manual-attestation design for a lakhs-of-transactions production launch. Keep it as a limited, clearly disclosed pilot only after appropriate review, or replace it with an official bank/PSP flow that verifies merchant identity and settlement. NPCI's merchant onboarding guidance says merchants need to partner with an acquiring bank for UPI infrastructure: [NPCI UPI FAQs](https://www.npci.org.in/what-we-do/upi/faqs). Review applicable RBI requirements with a qualified payments/legal professional before selecting the operating model.

The separate `doodhwala-pay` Edge Function currently reports `gateway_ready: false` and `money_moved: false` in its intent responses. It must not be represented as a live gateway.

## Required high-volume architecture

- Use a bank/acquirer or authorised payment provider with an appropriate marketplace/seller-settlement product. Onboard each seller with its required KYC and verify the settlement account through that partner's official flow.
- Create server-owned payment attempts from stored order totals. Use durable, unique idempotency keys and database-enforced constraints so retry, timeout and concurrent requests cannot charge twice.
- Confirm payment only from authenticated, signature-verified provider webhooks/callbacks. Verify the signature over the exact raw request bytes, validate event/account/amount/currency/order mappings, and reject old/replayed events. Never trust browser redirects, QR screens, screenshots or client-submitted references.
- Keep an append-only payment-event audit trail; process provider events idempotently, enforce allowed state transitions in the database, and reconcile internal records against provider/bank settlement reports.
- Use distributed/server-side rate limiting, abuse detection, per-account/per-device velocity controls, alerts and incident-response procedures. An in-memory rate limiter in an Edge Function instance is not a global high-volume rate-limit system.
- Define and test failure, duplicate callback, partial outage, delayed settlement, cancellation, refund/reversal, dispute and support flows. Monitor mismatched or missing settlements.
- Protect keys in server-side secrets only; separate staging and production; least-privilege database grants/RLS; enable leaked-password protection; audit admin actions; configure backups/recovery, logs and alerts.
- Complete independent security review, dependency/SAST scanning, API authorization testing, load testing and penetration testing before enabling real payments.

## Release gates

- [ ] Apply the payment migrations in order to an isolated staging project first; verify the corrected FK and readiness RPC in the actual target database.
- [ ] Re-run Supabase security advisors and inspect function execute grants, RLS, triggers and exposed-table grants.
- [ ] Demonstrate that checkout creates no order if payment controls are missing or a migration is partial.
- [ ] Test cross-customer and cross-seller access boundaries, duplicate/replayed callbacks, concurrent checkout retries, cancellation races and each payment state transition.
- [ ] Verify seller settlement-account ownership through the chosen bank/PSP, not a free-text name/UPI-ID comparison.
- [ ] Test PSP sandbox flows, then reconcile test payments, refunds and failures against provider records.
- [ ] Confirm monitoring, support, disputes, refunds/reversals and recovery drills are operational.
- [ ] Obtain applicable legal/compliance sign-off and an independent security assessment.
- [ ] Only then enable real-money collection for a controlled rollout with monitored limits; increase volume progressively.

**Boundary:** Source changes, passing static tests or a successful schema migration do not prove the system is secure at scale. No real-money transfer, bank settlement, authorised-PSP integration, or production penetration test was performed during this review.
