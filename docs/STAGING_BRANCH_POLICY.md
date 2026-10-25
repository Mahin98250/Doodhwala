# Doodhwala staging branch policy

**Branch:** `staging`  
**Purpose:** integrate and validate Doodhwala code changes before promoting them to `main`.  
**Database staging:** not yet available; no Supabase staging project or paid Supabase development branch exists.

## Important distinction

This Git branch is a safe code-integration lane. It is **not** a separate Supabase database, and it does not isolate data, Auth users, Storage buckets, Edge Functions, or production credentials by itself.

Production Supabase project ref: `hmiboyfcvtfawrwujslg`.

## Current no-cost workflow

1. Make feature changes on focused branches and open pull requests targeting `staging` for integration.
2. Run static contract tests and disposable PostgreSQL migration tests in CI.
3. Review the staging branch build and merge only changes that pass required checks.
4. Promote reviewed commits from `staging` to `main` via a pull request after review.
5. Do not run load tests, synthetic writes, schema migrations, or destructive checks against production.
6. Do not configure staging URL/key variables to point at the production project. The load-test workflow must remain blocked until a separate staging Supabase target is available.

## Required before real database staging

- A separate Supabase project or explicitly approved development branch with the cost confirmed first.
- A dedicated staging project ref, URL and public anon key; never use a service-role key in browser or CI load-test configuration.
- Synthetic users/providers/products/orders only.
- Reconciled migration history and schema, RLS/grants checks, and a documented reset/recovery procedure.
- A first manually triggered, read-only baseline run at 1 request/second for 30 seconds, with the workflow's explicit `STAGING` confirmation and target-ref/URL match.
- Save the commit SHA, run URL, metrics, data size and limitations. Do not claim capacity without measured results.

## Phase 1 status

- [x] GitHub `staging` branch created from `main`.
- [x] Migration history snapshot and static drift report merged to `main`.
- [x] Manual read-only load-test workflow blocks the known production ref and checks the configured staging ref against the URL.
- [ ] Separate Supabase staging database available.
- [ ] Migration/schema reconciliation against staging completed.
- [ ] End-to-end synthetic order flow verified.
- [ ] First staging load baseline run and archived.

**Safety rule:** a green CI result for disposable fixtures is not proof that the complete production schema is reproducible or that the live service can handle a particular concurrency level.
