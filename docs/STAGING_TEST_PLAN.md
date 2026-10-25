# Doodhwala staging test plan

Status checked: 2026-10-25. This is the release checklist for validating the Next.js migration without touching live customers, orders, payments, or production routing.

## Current staging blockers

- Supabase project **Doodhwala Staging** (`jbcekiaiyxcatueixeqh`) is separate from production, but its schema/migration history is only partially aligned with the repository's migration directory. Do not assume that a successful app build means backend parity.
- The staging database advisor currently reports `private.admin_allowlist` with RLS disabled. This is a security blocker. Do not expose the project to browser testing until the intended policy/migration is reviewed and RLS is enabled with correct access rules. Enabling RLS without policies may break intended admin access; review the migration and policy design first.
- The Vercel preview project `doodhwala-next-preview` exists, but configuring preview environment variables returned a permission error. No usable preview URL has been verified yet.
- Google OAuth and phone OTP provider settings/redirect allowlists have not been verified.
- Do not copy production customer records, auth users, payment credentials, or live payment configuration into staging.

## Environment isolation

Use only:
- Supabase project URL for Doodhwala Staging.
- A publishable key generated for that staging project.
- Vercel **Preview** environment variables scoped to branch `architecture/nextjs-migration-foundation`.
- Synthetic test identities and test catalogue data.
- No service-role key in any `NEXT_PUBLIC_*` variable or browser bundle.

Never point the preview build at the production Supabase project. Confirm the displayed project URL/ref in Vercel settings before testing.

## Setup sequence

1. **Review schema before applying it.** Compare `supabase/migrations` with staging's migration history. Resolve any missing/out-of-order migrations against the checked-in SQL in chronological order. Apply only to the staging project, stop at the first SQL error, and verify the schema and migration history after each batch. Do not copy production data.
2. **Resolve database security findings.** Inspect policies for `private.admin_allowlist` and other private tables. Confirm the schema is not exposed through the Data API, RLS is enabled, and only the intended admin authorization path can access allowlist rows. Run the project's security advisor again.
3. **Configure Vercel preview.** Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in Preview only, scoped to `architecture/nextjs-migration-foundation`. Never add a service-role/secret key. If the API denies environment-variable edits, an authorized project owner must grant the required Vercel project permissions or add the variables in Vercel Dashboard.
4. **Configure Auth.** Add the exact preview origin to Supabase Auth's allowed redirect URLs. Enable/configure Google OAuth and phone OTP only if those flows are part of the test pass; use test credentials/controlled SMS and set reasonable rate limits.
5. **Deploy the branch as Preview.** Confirm the deployment commit SHA equals the tested PR head. Keep the project non-production and do not attach the live domain.
6. **Run smoke checks.** Confirm home, provider discovery, storefront, product, sign-in/sign-up, account, cart, checkout, orders, subscriptions, seller, owner, support, legal, offline, legacy aliases, 404, and security headers load. Check mobile widths and keyboard-only navigation.
7. **Run authenticated journeys** using dedicated test accounts and synthetic records. Verify actual RPC payload/response shapes and RLS behavior—not just UI messages.
8. **Reset test data** only using a documented, reviewed cleanup procedure that targets staging IDs. Preserve logs and screenshots of failures.

## End-to-end test matrix

| Role / area | Test actions | Required result |
| --- | --- | --- |
| Anonymous customer | Open home, search nearby sellers, filter catalogue, view store/product | Only public/approved seller data appears; empty/error/loading states work |
| Authentication | Sign up/in/out, expired session, Google callback, phone OTP, password recovery, unsafe return URL | Correct redirects; no external redirect; failures are understandable; no session leakage |
| Profile & address | Complete profile, add/edit/delete own address, grant location only after explicit action | Customer can access only their own data; location is not silently persisted |
| Cart & checkout | Add/remove quantities, multi-seller cart, stale price, unavailable product, invalid promo, unsupported delivery area | Server validates prices, stock, promo and coverage; invalid order is rejected clearly |
| Order reliability | Submit twice rapidly, retry after network error, open another customer's order ID | One logical order per idempotency key; unauthorized order reads/cancels fail |
| COD / direct UPI | Select COD; hand off to seller UPI; cancel/return from UPI app; seller acknowledges receipt | No client-side claim of payment success; only allowed seller/backend flow changes receipt state |
| Subscriptions | Create, edit, pause, resume, skip, cancel | Ownership, cutoff, delivery schedule, address and capacity rules are enforced server-side |
| Seller | Manage own products, availability, orders, service area and UPI settings | Seller cannot edit another seller's records or confirm an unrelated order's payment |
| Owner/admin | View overview, moderation, support, audit and system health; attempt with customer account | Admin functions are denied to non-admins server-side; privileged changes are audited |
| Support & policies | Create ticket, view own ticket history, inspect legal/offline pages | Ticket privacy is enforced; recovery page does not lose useful navigation |
| Resilience | API timeout, RPC error, offline mode, refresh/deep link, slow network | No blank screen or duplicate mutations; errors are actionable; retry is safe |

## Release gates

Do not merge PR #60 or switch production traffic until all are true:

- [ ] Staging schema/migrations are reconciled with repository migrations.
- [ ] All security-advisor findings are resolved and reviewed, including private-schema RLS.
- [ ] Preview uses staging URL/key only; no production credentials in preview variables.
- [ ] CI passes: tests, typecheck, build, route smoke, static and SQL validation.
- [ ] Customer, seller, and admin end-to-end journeys pass on desktop and mobile.
- [ ] Negative authorization tests pass for ownership, role, price, coverage, idempotency, and payment confirmation.
- [ ] Google OAuth/OTP/recovery redirects verified if enabled.
- [ ] Rollback rehearsal completed and existing production app remains available.

## How to test manually

1. Open the protected Vercel Preview URL on a phone and desktop.
2. Register a dedicated staging customer; create a separate test seller and owner/admin identity through the approved staging-only process.
3. Seed synthetic sellers/products/addresses in staging only; never use real customer records.
4. Follow the test matrix top to bottom and record pass/fail plus the failing route, role, timestamp, and sanitized console/network error.
5. Re-run the affected journey after a fix and confirm CI is green on the new commit SHA.
