# YouPI-PG compatibility audit for DoodhWala Pay

**Reviewed:** 22 October 2026  
**Scope:** Public repository source/docs review and comparison with DoodhWala Pay on `main`.  
**Decision:** Do not import or deploy YouPI-PG as DoodhWala's live payment gateway. Use it as a research reference only until licensing, source trust, bank/provider acceptance, marketplace flow, and independent security review are resolved.

This is a source review, not an executed penetration test. YouPI-PG's code was not installed or run, no live payment attempt was made, and no bank account or customer data was accessed. Findings below are based on publicly viewable files and may change with upstream commits.

## Executive assessment

YouPI-PG is a substantial self-hosted UPI QR and Cash-on-Delivery application with a Node.js API, SQLite persistence, checkout/admin services, a WhatsApp OTP flow, Android/SMS/Gmail observers, a payment queue and HMAC-signed outbound webhooks. It contains some useful engineering ideas, including integer-paise arithmetic, idempotency, explicit payment states, webhook delivery retries, outbound webhook URL validation, and HMAC checks for registered observer devices.

However, its own README labels it an **experimental research project**, says it is not a certified/bank/NPCI-approved/audited/production-ready gateway, and warns against relying on it as the sole source of payment confirmation. Its package manifest declares `"license": "Commercial"`; a root `LICENSE` file was not found during this review. Do not copy, vendor, or redistribute its source until the owner provides clear written permission/license terms.

## Findings and risk

### P0 — Licensing blocks code reuse

- Evidence: [package.json](https://github.com/youpi-pg/YouPI-PG/blob/main/package.json) declares `"license": "Commercial"`; no root `LICENSE` file was found in the repository tree during this review.
- Impact: a public GitHub repository is not automatically permission to reuse its code.
- Action: use source links for learning only; request written permission and explicit license terms before copying, vendoring, adapting or redistributing code.

### P0 — Bank-alert observations are not equivalent to authoritative payment-provider confirmation

- Evidence: [attribution-engine.js](https://github.com/youpi-pg/YouPI-PG/blob/main/packages/core/src/attribution-engine.js) accepts a first matching observation, opens a grace window, and contains a path that finalizes success after that window when a second source did not arrive. The README and architecture describe Level 1 single-source confirmation as a possible success outcome.
- Risk: SMS, push notifications and email can be delayed, missing, duplicated, malformed or spoofed. HMAC can authenticate a paired observer's message, but it does not independently prove that a bank settled the payment. An observer device or mailbox compromise could undermine the signal.
- Action: do not use a browser callback, screenshot, parsed alert, or single observer as the only authority for marking an order paid. Prefer server-to-server confirmation from a suitable acquiring/payment provider and reconcile against its transaction/reporting records. Any observer-based fallback must remain pending/manual-review until independently reconciled.

### P0 — Payment creation accepts client-supplied amount and allows an unauthenticated default-merchant path

- Evidence: [payments.routes.js](https://github.com/youpi-pg/YouPI-PG/blob/main/apps/payment-api/src/routes/payments.routes.js) reads `orderId` and `amount` from the request body, converts that amount to paise, and intentionally permits an unauthenticated browser integration for the configured default merchant.
- Impact: this design allows arbitrary payment-session requests against the default merchant; rate limiting and abuse controls must prevent session spam and operational exhaustion. It is not by itself proof that funds are collected or that a payment can be forged as settled.
- Action for DoodhWala: continue deriving the payable amount from the server-owned order, validate ownership and payable status, enforce a database idempotency key, and keep the payment ledger unavailable for direct browser writes. DoodhWala's current intent function follows the server-calculated amount/ownership approach.

### P1 — A tracked WhatsApp-session metadata file contains a phone number

- Evidence: [data/test_whatsapp_session.json](https://github.com/youpi-pg/YouPI-PG/blob/main/data/test_whatsapp_session.json) includes a phone-number field and session metadata.
- Impact: the file may expose personal information. The reviewed file does not itself contain an obvious bearer token or password, and this review cannot establish whether the number is synthetic or whether a live account is attached.
- Action: remove or redact it if it represents a real person/account; inspect repository history and rotate credentials/re-pair sessions if any live session secret was ever committed. Keep session files and observer state out of version control.

### P1 — Example webhook verification is easier to implement incompletely than the fuller documented contract

- Evidence: the README's short Node.js webhook example checks an HMAC over raw request bytes using constant-time comparison, while the wider integration docs also describe timestamp freshness and delivery-ID replay/idempotency controls. The sample handler does not demonstrate those additional checks.
- Risk: integrators may copy the short sample and omit replay protection or idempotent event processing.
- Action: for DoodhWala, require signature verification over the exact raw body, timestamp/freshness checking, unique provider event IDs, replay protection, order/reference/amount/currency validation, and idempotent state transitions before any order is marked paid.

### P1 — Setup template has recognizable example secrets

- Evidence: [.env.example](https://github.com/youpi-pg/YouPI-PG/blob/main/.env.example) includes recognizable values for `JWT_SECRET`, `INITIAL_ADMIN_PASSWORD`, and `ANDROID_ENROLLMENT_SECRET`.
- Impact: copying the template and forgetting to replace those values can weaken a self-hosted deployment.
- Action: reject known/default secrets at production startup, generate unique high-entropy secrets, keep them server-side, and rotate any value that has been used on an exposed instance.

### P2 — Deployment/runtime prerequisites are inconsistent

- Evidence: [package.json](https://github.com/youpi-pg/YouPI-PG/blob/main/package.json) declares Node.js `>=24.0.0`, while README/architecture setup text refers to Node.js `>=20.0.0`.
- Impact: an operator could install on an unsupported runtime or debug avoidable start/build failures.
- Action: follow the package engine for local evaluation and ask upstream to reconcile all docs before relying on it.

## Good patterns worth considering (independent of copying its code)

- Represent money as integer minor units (paise), not floating-point values.
- Enforce payment and order transitions using explicit allowlists and database constraints.
- Use database idempotency and handle concurrent retries.
- Verify webhooks against raw bytes, use constant-time signature comparison, and prevent replays.
- Revalidate merchant-configured outbound webhook URLs, reject unsafe destinations, and do not follow redirects blindly.
- Keep the admin/observer control plane separate from the customer checkout surface.
- Maintain a durable audit/event inbox, retry queue, reconciliation view, and manual exception process.

These are general engineering patterns, not an endorsement of the upstream implementation.

## Fit with DoodhWala

DoodhWala is a **marketplace where independent local milk sellers fulfil orders**. YouPI-PG is organized around a self-hosted gateway instance with receiving VPAs and a single-active-slot FIFO queue because bank alerts often lack a unique merchant reference. That queue can serialize payments to one receiving account, so it is not a straightforward high-throughput marketplace payment rail.

A further mismatch is settlement: payments sent directly to a seller's UPI account are different from collecting funds centrally and settling multiple independent sellers. Do not pool seller money or promise split settlement through a custom layer without confirming the bank/provider arrangement and applicable requirements with qualified professionals. NPCI's UPI FAQ describes merchant onboarding through an acquiring bank and discusses the bank's due diligence/merchant configuration process: https://www.npci.org.in/what-we-do/upi/faqs

### DoodhWala's current payment foundation

The DoodhWala implementation is intentionally more conservative at present:

- A server-owned `payment_transactions` ledger records an intent; the browser cannot directly write payment states.
- The Edge Function authenticates the customer, checks order ownership, derives amount from the stored order and uses idempotency.
- A database migration adds a provider-event inbox and guards allowed payment-state transitions.
- The API deliberately returns `gateway_ready: false` and `money_moved: false`; it is **not a live payment gateway**.
- The publishable-key allowlist now fails closed when missing/empty, and intent creation is restricted to known pre-delivery order states.

Repository source: [DoodhWala payment function](https://github.com/Mahin98250/Dudh-Wallah/blob/main/supabase/functions/doodhwala-pay/index.ts), [payment migration](https://github.com/Mahin98250/Dudh-Wallah/blob/main/supabase/migrations/20261022120000_doodhwala_pay_foundation.sql), and [state/event migration](https://github.com/Mahin98250/Dudh-Wallah/blob/main/supabase/migrations/20261022133000_doodhwala_pay_event_ledger.sql).

## Recommended next engineering sequence

1. Select an appropriately onboarded payment/acquiring provider whose terms support the intended marketplace/seller model; do not infer eligibility or compliance from the availability of source code.
2. Implement one provider adapter on the server side. Keep all keys/secrets off the browser and keep live collection feature-disabled until provider sandbox credentials and configuration are verified.
3. Add a dedicated webhook endpoint that verifies the provider's actual signature scheme over raw bytes, validates transaction reference/amount/currency/order state, and persists events idempotently before changing status.
4. Add non-production end-to-end tests for success, failure, cancellation, duplicate/delayed/out-of-order webhooks, incorrect amount/currency, timeouts, refunds, and concurrent retries.
5. Add a marketplace ledger and reconciliation process for seller allocations, refunds, fee policy, disputes and settlement reports before any seller payouts.
6. Complete an independent security review and obtain qualified legal/compliance review before production payments.

**Decision:** do not import YouPI-PG code or enable observer-driven success in DoodhWala. Continue building a provider-agnostic payment-intent layer and integrate a suitable acquiring/provider service once onboarding, license/contract, and tests are settled.
