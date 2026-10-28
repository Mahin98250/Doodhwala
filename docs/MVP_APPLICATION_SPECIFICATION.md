# Doodhwala — MVP application specification

**Status:** Draft specification. The owner has approved the manual payment model below; other scope decisions and all launch gates remain open. This is not an implementation or launch certification.

**Reviewed source:** repository snapshot `3c102f6`.

**Purpose:** Define the smallest reliable product that can be piloted with real local milk sellers and customers.

## 1. Product goal and pilot assumptions

Doodhwala connects a customer with an independent neighbourhood milk seller. A customer can find a seller, place an order and know its status; the seller can accept and fulfil it; the Doodhwala operator can handle exceptions.

**Proposed first pilot:** one small service area, a handful of approved sellers, and a limited group of households. The precise area, pilot size and dates require owner approval. The application is a mobile-first website/PWA, also usable on desktop.

**Approved payment model:** the customer pays the seller the full milk-order amount directly. The seller chooses a separate monthly Doodhwala plan: ₹2,000 for a normal listing, or ₹3,500 total for a listing with a text-only “Recommended by Doodhwala” label and in-app advertising. The ₹3,500 is not an add-on. The initial promotion is a seller-card text label with an adjacent Sponsored disclosure and a neutral invitation to view that seller's details. Tax treatment, billing terms, campaign limits and payment details remain to be approved. Seller billing must not be deducted from or mixed with customer orders.

**Payment pilot direction:** offer Cash on Delivery (COD) and direct seller UPI with manual seller confirmation, only after their staging, security, operational and compliance gates are met. Daily recurring plans remain conditional scope. The earlier COD-only recommendation was not an approved removal of UPI.

**Success:** the complete customer → seller → delivery → payment-status journey is reliable, understandable and supportable; seller and customer accounts cannot access one another's private data. Source code or a green build alone is not proof of readiness.

## 2. Users and permissions

| Role | Main need | Access boundary |
| --- | --- | --- |
| Visitor | Browse genuine sellers and milk products. | Public catalogue only; no private customer, seller or admin data. |
| Customer | Order milk, track status, manage their address and request help. | Their own profile, addresses, orders and support requests. |
| Seller | Publish their milk and fulfil their own orders. | Their own business, products and orders; only the customer details needed to fulfil those orders. |
| Doodhwala operator/admin | Review sellers, investigate orders and resolve support cases. | Explicitly granted admin access, with sensitive actions recorded and protected. |

A user may have more than one permitted role, but role and ownership checks must be enforced on the server/database—not only by hiding buttons.

## 3. Required screens and behaviour

### 3.1 Customer-facing screens

| Screen | Required content and actions | Acceptance criteria |
| --- | --- | --- |
| **Home / discovery** | Browse approved, active independent sellers; search by seller, area or milk; see product price, delivery area and availability. Offer location selection without requiring device GPS permission just to browse. | Search and filters work across the complete result set, not only the currently loaded page. Unavailable or unapproved sellers cannot be ordered from. Empty, loading and connection-error states are truthful. |
| **Seller / product** | Seller name, locality, delivery window, available milk types, units, prices and relevant seller licence/registration information. Add an available product to the cart. | Information comes from approved live records, not demo data. Unavailable products cannot be ordered. Price and unit are clear before adding. |
| **Sign-in / account** | Sign in, sign out, recover access and manage the minimum profile details needed for delivery. Email/password is sufficient for the first pilot; other methods are optional. | All links and return paths work. Staging authentication and recovery stay in staging. A signed-out user is asked to sign in before ordering. |
| **Cart / checkout** | Quantities, seller, item prices, total, delivery details, payment method, order note and a final confirmation action. | The server rechecks the address, seller, service area, product, price and capacity. Successful confirmation shows the real order ID and its actual status. A retry cannot create a duplicate order. |
| **Orders** | Current and past orders, seller, items, amount, delivery details, status, payment status and the applicable cancellation/help action. | A customer's status matches the server's latest committed state. Cancellation is offered only when permitted by the approved policy and enforced server-side. COD is labelled correctly. |
| **Help / policies** | A working support contact or request form; approved terms, privacy, cancellation and complaint information. | A customer can reach an operator and obtain a reference or other acknowledgement. No draft policy is presented as final. |

**Cart scope decision:** a single seller per checkout is recommended for the first pilot. If multi-seller checkout is retained, each seller order must be independently identified, partial success must be clear, and unplaced items must stay in the cart.

### 3.2 Seller-facing screens

| Screen | Required content and actions | Acceptance criteria |
| --- | --- | --- |
| **Seller sign-up / profile** | Business and owner name, contact, locality, service area, delivery window, applicable licence/registration details and approval status. | New sellers remain pending until an authorized operator approves them. Sellers cannot self-approve or appear as approved before checks are completed. |
| **Products** | Add, edit, activate/pause a milk product and set its unit, price and availability. | A valid new product persists to the backend and remains visible after reload; editing changes the correct owned product; another seller cannot modify it. |
| **Orders / daily queue** | New and active orders, quantities, delivery details, payment choice and actions to accept, reject or progress an order. | The seller sees only their own orders. Each action is accepted or rejected by the server with a clear result; a refresh shows the committed state. |
| **Service settings** | Manage service area, delivery window, availability and any configured capacity. | Changes persist and are enforced during customer discovery/checkout. Existing accepted orders are not silently lost. |

The queue should show new orders on refresh and may also use realtime updates. Push notifications are not required for the first pilot if the operator has a reliable, agreed fallback for contacting sellers.

### 3.3 Operator / admin screens

| Screen | Required content and actions | Acceptance criteria |
| --- | --- | --- |
| **Seller review** | Review seller identity, relevant licence/registration information, service area and products; approve, reject or deactivate. | Only an authorized admin can change approval. The decision and reviewer are auditable. No verification claim is displayed without the corresponding real checks. |
| **Orders / exceptions** | Find orders by ID and view the current state, seller and minimal customer details needed to resolve an issue. | Operators can identify overdue, failed or disputed orders without silently changing an order or payment state. Sensitive access is restricted. |
| **Support** | Review customer support requests, record an outcome and communicate through an agreed channel. | Each request can be tracked through to resolution; a real support contact is published and monitored. |

Basic counts are useful, but advanced analytics and automated seller billing are not required for the initial pilot.

## 4. Functional rules

### 4.1 Order lifecycle

1. Before submitting, the customer sees the seller, items, quantities, server-validated amount, address, delivery information and payment method.
2. A newly created order is **placed/pending seller acceptance**, not automatically accepted or delivered. It has a unique ID and stores the price, quantity and delivery details that applied at creation.
3. The seller may accept or reject the order using allowed server-side transitions. Existing intermediate states may include preparing, ready and out for delivery; delivered, rejected and cancelled are final states under the approved policy.
4. Customers and sellers see the same committed order state after refresh. The interface never substitutes a guessed or optimistic success state for server confirmation.
5. The owner must approve the cancellation cutoff, response deadline and what happens to unanswered or unavailable orders. Until an automated escalation is implemented and verified, the operator must monitor and resolve exceptions manually.
6. A repeated click, refresh or lost network response must not create a second order for the same attempt. If the result is uncertain, preserve the cart and explain how to check or safely resume the existing order; never assert that no order exists without confirmation.
7. Promo order creation must be disabled through both the UI and server-accessible paths, or brought into the same safe, tested checkout flow. Hiding a button alone is not sufficient.

### 4.2 Cash on Delivery

- A customer explicitly chooses COD; order creation and recording that choice must be consistent and retry-safe. The actual cash transfer is a separate real-world event.
- The seller or authorized delivery person collects the amount. Only the authorized seller can record collection through the supported flow after delivery, according to the approved operating policy.
- The customer sees **Cash on Delivery** and an accurate unpaid/collected status. The system does not mark cash collected merely because an order was placed or delivered.
- Doodhwala does not hold customer order funds under the approved model. Seller monthly fees are recorded and reconciled separately, once their terms and implementation are approved.
- A missing or uncertain payment choice must not strand an order without an operator/customer recovery path. No payment or order success should be inferred from a browser callback.

### 4.3 Direct seller UPI — approved direction, subject to launch gates

Before enabling it, verify the seller's identity and payment details using an approved operational process. The customer must see the intended seller/payee, amount and that money goes directly to the seller.

Returning from a UPI app, a screenshot or a customer claim is **not proof of settlement**. Payment remains pending until the authorized seller confirms after checking their own bank/UPI account. Label this as seller-confirmed, not independently bank-verified. Provide a dispute/reversal process. A real automated payment gateway is not implemented merely by the existing gateway foundation.

### 4.4 Daily recurring plans — only if approved for MVP

If daily delivery is a day-one requirement, include the following rather than exposing an unverified plan screen:

- Customer selects seller, milk, quantity, address, schedule, start/end dates if applicable, and an explicitly agreed payment method. Show the next deliveries and applicable cutoff before confirmation.
- Customer can skip, pause, resume or cancel according to owner-approved rules. Changes are enforced server-side and visible to the seller.
- Scheduling uses the service area's correct local time and is retry-safe: repeated scheduler runs do not create duplicate deliveries/orders.
- Each generated order receives a valid agreed payment choice and can progress through the seller workflow. A seller at capacity must not abort the processing of unrelated due deliveries.
- Failed or overdue deliveries are visible to the operator, with a defined retry or resolution path. Test scheduler execution in staging; do not assume it is running in production.

Until these conditions pass, remove or disable the customer entry points **and** prevent unsupported plan/order creation through server-accessible paths.

## 5. Data, security and operational requirements

- Use separate staging and production Supabase projects and environment-appropriate auth redirects. Reconcile the existing migration-history differences before applying migrations; obtain approval, backups and a rollback plan before any production change.
- Enforce ownership, role permissions, serviceability, stock/capacity and server-derived prices in database policies/RPCs. Test with at least two customers, two sellers and an admin.
- Never place service-role keys or other secrets in browser code. Never collect UPI PINs, banking passwords, card CVVs or one-time codes in support requests.
- Collect only the personal and location information required for the service. Limit address/contact visibility to authorized users. Have an approved retention, access and deletion-request process; do not promise automatic deletion until it is implemented.
- Use operational logs and alerts without exposing sensitive personal data or secrets. Identify who monitors failures and how they are resolved.
- Test backup restoration in an isolated environment. Record deployment version, migration status, rollback steps and the operator responsible for a release.
- The app must remain usable on a common mobile viewport and desktop, with accessible labels, keyboard-operable controls, and clear loading, empty, offline, error and success states. An offline screen or cached cart must never claim that an order was placed.
- Before commercial use, obtain qualified Indian legal/food-safety advice on the platform's licence, seller obligations, applicable consumer rules and tax/privacy requirements. FSSAI provides guidance on online food-platform licensing [1](https://foscos.fssai.gov.in/faqs-license-registration?faqType=LR) and displaying seller licence/registration information [12](https://www.fssai.gov.in/upload/advisories/2024/12/674efa161d756Adobe%20Scan%203%20Dec%202024.pdf).

## 6. Minimum acceptance test matrix

Execute these against authorized, isolated staging accounts and record the build, environment, steps and result. Do not create synthetic orders or payment records in production.

| ID | Scenario | Pass condition |
| --- | --- | --- |
| A1 | Seller registers, operator approves, seller creates a product. | Only the approved seller's active product becomes discoverable; it persists after reload. |
| A2 | Customer signs in, finds that product and places a COD order. | Exactly one order is created with the correct seller, address, server price and payment choice; the real order ID is shown. |
| A3 | Seller accepts, progresses and delivers that order, then records cash collection. | Both users see matching committed order/payment states; payment is not marked collected before authorized confirmation. |
| A4 | Double-click, refresh and lose connection during order creation/payment-choice handling. | No duplicate order; cart and order ID can be recovered; no false “no order placed” or false success message. |
| A5 | Submit an unavailable/out-of-area product or use disabled promo paths. | The server rejects the unsupported request safely; no order or promo redemption is created. |
| A6 | Reject, cancel or attempt an invalid status transition. | Only approved transitions and policy-permitted actions succeed; both parties receive an accurate outcome. |
| A7 | Cross-account and cross-seller access, direct RPC/table calls, and admin-only actions. | Unauthorized reads and writes are denied by the backend, including when the UI is bypassed. |
| A8 | Search and saved sellers across multiple pages. | Matching approved sellers are found, including sellers not on the first loaded page. |
| A9 | Mobile/desktop browser, sign-out, recovery, poor network and PWA update/offline. | Controls are usable; auth returns to the correct environment; errors are honest and no offline order is falsely confirmed. |
| A10 | Backup/restore and release rollback in isolation. | A documented recovery is completed and checked without touching production. |
| A11 | Recurring plan, if enabled: due run, retry, skip/pause and seller at capacity. | No duplicate or payment-pending dead-end order; one full seller does not abort unrelated deliveries. |
| A12 | Direct UPI, if enabled: return from app, seller confirmation and dispute. | Return alone never marks payment successful; only authorized seller attestation changes the supported status and its limitation is clear. |

A pilot is blocked by unresolved high-severity security issues, false order/payment confirmations, unapproved legal/food-safety requirements, or failed applicable test cases. A passing static test or route-loading smoke test is insufficient by itself.

## 7. Current repository: implementation gaps

These observations describe the reviewed baseline `3c102f6`, not the currently deployed Supabase state. The current working branch proposes atomic checkout and disabled promo paths, but these remain undeployed and require staging integration and release review; see [the manual pilot plan](MANUAL_CONFIRMATION_PILOT.md).

| Area | Present in source | Work before MVP acceptance |
| --- | --- | --- |
| Customer discovery | Browse/search, saved sellers and paginated results. | Search/saved filtering currently misses unloaded pages; the seller-card Plan action navigates incorrectly. See [`app.js`](../app.js). |
| Auth and navigation | Auth and shared session controls. | The signed-out homepage link and customer desk order link duplicate the base path; auth redirects/configuration are tied to production. See [`session-controls.js`](../session-controls.js), [`customer-market-10x.js`](../customer-market-10x.js) and [`auth.js`](../auth.js). |
| Checkout / COD | Checkout, idempotency handling and payment-choice RPCs. | Legacy promo checkout bypasses readiness/payment selection; a payment-choice failure can leave an unrecorded existing order and misleading retry message. COD display label is incorrect. See [`checkout-10x.js`](../checkout-10x.js), [`checkout.js`](../checkout.js) and [`orders.js`](../orders.js). |
| Seller products | Product editor and upsert RPC. | Incorrect selectors break saving; new products pass an ID where the RPC expects a new insert. See [`provider.js`](../provider.js) and the [product RPC migration](../supabase/migrations/20261008024500_provider_phase2_operations.sql). |
| Daily plans | Plan UI, delivery materializer and payment guard. | With the relevant migrations, generated orders can remain `selection_pending`; the full-capacity branch references a field not selected into its record. Production scheduler/deployment is unverified. See the [materializer](../supabase/migrations/20261007182300_doodhwala_subscription_capacity_hardening.sql) and [payment guard](../supabase/migrations/20261022152000_doodhwala_payment_choice_race_guard.sql). |
| Admin / support / PWA | Admin, support and offline components exist. | Verify real role isolation, actual support operations and mobile/staging behaviour; existing draft legal and support information must be completed. |
| Database / release | SQL migrations, CI checks and GitHub Pages source exist. | Historical migration drift and current production state must be reconciled before deployment; static and fixture checks do not prove live integration. See [`STAGING_BASELINE.md`](STAGING_BASELINE.md). |

## 8. Recommended implementation sequence

1. **Agree scope and rules:** decide one-time versus recurring, payment methods, service area, cancellation rules and seller fees. Obtain relevant compliance advice in parallel.
2. **Establish safety:** staging isolation, migration inventory, test roles, backup and rollback plan. Keep unsupported promo/payment/plan paths disabled.
3. **Make ordering reliable:** one server-validated, idempotent checkout flow; truthful confirmation, payment selection and recovery; seller order lifecycle.
4. **Fix daily usability:** seller product editor; auth and navigation; discovery pagination; accurate COD/status messages; operator support.
5. **Validate approved direct UPI:** use manual seller confirmation only after its dedicated tests and launch gates pass. Implement recurring plans only if separately approved and tested.
6. **Validate and pilot:** run the acceptance matrix, resolve blockers, onboard a small set of approved sellers and monitor real support outcomes.

## 9. Explicitly deferred unless the owner changes scope

Native app-store releases, automated payment gateway/settlement, wallets, marketplace commission splitting, AI features, live GPS tracking, advanced marketing/ratings, complex analytics, automated seller-subscription invoicing and large-scale optimization. Manual, transparent operational processes may be used where appropriate; they do not replace required security, food-safety or consumer obligations.

## 10. Product-owner decisions needed

1. Are **recurring daily plans** required for the first pilot, or should it start with one-time orders?
2. How will the approved **COD and manual direct-UPI** pilot be staged, supported and authorized for launch?
3. Will a checkout contain **one seller** or multiple separately fulfilled seller orders?
4. What are the service area, delivery window, seller response deadline, cancellation/skip cutoffs, quantities and any delivery fees?
5. For the selected ₹2,000/₹3,500 monthly seller plans, what taxes, due dates, plan-change/proration rules, invoicing process and campaign limits are approved? The initial in-app promotion is text on the existing seller card with a Sponsored disclosure; do not imply it is live.
6. Who is responsible for seller verification, support, food-quality escalation, payment disputes and monitoring?
7. Which legal entity, food licence/registration details, contacts, policies and retention/deletion rules have been reviewed and approved?

Until these decisions are approved, the recommendations above are assumptions for planning—not claims about the live business.
