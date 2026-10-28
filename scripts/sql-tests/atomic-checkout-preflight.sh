#!/usr/bin/env bash
# Run only on the disposable synthetic PostgreSQL database, after the atomic migration.
set -euo pipefail
migration=supabase/migrations/20261028100000_doodhwala_atomic_manual_checkout.sql

expect_migration_failure() {
  local expected=$1 output status=0
  output=$(psql -X -1 -v ON_ERROR_STOP=1 -f "$migration" 2>&1) || status=$?
  if [[ $status -eq 0 ]] || ! grep -Fq "$expected" <<<"$output"; then
    printf 'Expected migration failure %s, got status %s:\n%s\n' "$expected" "$status" "$output" >&2
    exit 1
  fi
  printf 'Confirmed preflight rejects %s\n' "$expected"
}

# A grant inherited by authenticated must abort the migration rather than leave
# the old order-creation path callable after direct grants are revoked.
psql -X -v ON_ERROR_STOP=1 <<'SQL'
create role atomic_legacy_grantee nologin;
grant execute on function public.create_order(uuid,uuid,jsonb,text) to atomic_legacy_grantee;
grant atomic_legacy_grantee to authenticated;
SQL
expect_migration_failure atomic_checkout_legacy_privilege_remains
psql -X -v ON_ERROR_STOP=1 <<'SQL'
revoke atomic_legacy_grantee from authenticated;
revoke execute on function public.create_order(uuid,uuid,jsonb,text) from atomic_legacy_grantee;
drop role atomic_legacy_grantee;
SQL

# Inherited membership must not expose the new authenticated RPC to anon.
psql -X -v ON_ERROR_STOP=1 -c 'grant authenticated to anon;'
expect_migration_failure atomic_checkout_rpc_privileges_invalid
psql -X -v ON_ERROR_STOP=1 -c 'revoke authenticated from anon;'

# A definer without access to the private creator must not be installed.
psql -X -v ON_ERROR_STOP=1 <<'SQL'
create role atomic_underprivileged_owner nologin;
grant create on schema public to atomic_underprivileged_owner;
alter function public.customer_create_order_with_payment(uuid,uuid,jsonb,text,text,text) owner to atomic_underprivileged_owner;
SQL
expect_migration_failure atomic_checkout_definer_missing_dependency_privileges
psql -X -v ON_ERROR_STOP=1 <<'SQL'
alter function public.customer_create_order_with_payment(uuid,uuid,jsonb,text,text,text) owner to postgres;
revoke create on schema public from atomic_underprivileged_owner;
drop role atomic_underprivileged_owner;
SQL

# Ensure the clean synthetic schema can be migrated/reapplied transactionally.
psql -X -1 -v ON_ERROR_STOP=1 -f "$migration"
