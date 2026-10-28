#!/usr/bin/env bash
# Reproducible synthetic integration check ONLY. NEVER point this at a live DB.
# Requires psql, sha256sum, a NEW disposable PostgreSQL database, and the six
# exact PR #71 migration files at 18fc96802e001d5b4d98b84ffe400cca2a5fbc70.
# The database-name and confirmation checks are operator reminders, not proof
# of environment safety: independently verify PGHOST/PGPORT and the project.
set -euo pipefail

root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
cd "$root"
: "${PGDATABASE:?Set PGDATABASE to a new disposable database}"
PR71_DIR=${PR71_DIR:-scripts/sql-tests/vendor/pr71}
PR71_DIR=$(cd "$PR71_DIR" && pwd)
if [[ "$PGDATABASE" != doodhwala_disposable_* || "${DOODHWALA_DISPOSABLE_DB_CONFIRMED:-}" != yes ]]; then
  echo 'Use a new doodhwala_disposable_* database and confirm it is disposable; never use production.' >&2
  exit 1
fi

(
  cd "$PR71_DIR"
  sha256sum -c - <<'CHECKSUMS'
0d9854335a1d0179462a157c3c2a0671339acbef760e77145cfc5b56f9166a3a  20261026120000_doodhwala_provider_monthly_billing.sql
6a68db3953efe28aced76a1510e6918198c09b797dd3ce0131751d6d6a45f160  20261026121000_doodhwala_provider_billing_rpcs.sql
e1db950d23a57edc473b03e4dae3b3724323a3674728a7dfa94c06a925dd0d6d  20261026122000_doodhwala_provider_billing_indexes.sql
1a479fbcf680cd46ae3b934ccb4099ad26217aea099333b693d4d839226be50d  20261026123000_doodhwala_admin_get_provider_billing_settings.sql
598210d03d0948e2e41a86e8c5289595b95ad48baa62a5303cad4aa452195547  20261026124000_doodhwala_provider_billing_reference_unique.sql
da14124c887da8ec7a3be48c87835f03f4b8e8b31e4af77ad96c6a7b3e73bc26  20261026125000_doodhwala_provider_invoice_month_idempotency.sql
CHECKSUMS
)

empty=$(psql -X -qAt -v ON_ERROR_STOP=1 -c "select not exists (select 1 from pg_namespace where nspname in ('auth','private')) and to_regclass('public.orders') is null and to_regclass('public.provider_billing_plans') is null")
if [[ "$empty" != t ]]; then
  echo 'The synthetic fixture requires a new empty database; stopping.' >&2
  exit 1
fi

apply() { psql -X -1 -v ON_ERROR_STOP=1 -f "$1"; }
apply scripts/sql-tests/atomic-checkout-fixture.sql
for migration in \
  supabase/migrations/20261007182600_doodhwala_provider_operating_status.sql \
  supabase/migrations/20261022150000_doodhwala_direct_seller_payments.sql \
  supabase/migrations/20261022151000_doodhwala_direct_upi_settings_read.sql \
  supabase/migrations/20261022152000_doodhwala_payment_choice_race_guard.sql \
  supabase/migrations/20261022153000_doodhwala_guard_payment_field_writes.sql \
  supabase/migrations/20261022154000_doodhwala_direct_upi_pending_only.sql \
  supabase/migrations/20261023050000_doodhwala_payment_controls_readiness.sql \
  supabase/migrations/20261023100000_doodhwala_recheck_seller_approval_for_upi.sql \
  supabase/migrations/20261023150000_doodhwala_payment_audit_and_reference_guard.sql \
  scripts/sql-tests/manual-ledger-admin-fixture.sql; do
  apply "$migration"
done
for migration in \
  20261026120000_doodhwala_provider_monthly_billing.sql \
  20261026121000_doodhwala_provider_billing_rpcs.sql \
  20261026122000_doodhwala_provider_billing_indexes.sql \
  20261026123000_doodhwala_admin_get_provider_billing_settings.sql \
  20261026124000_doodhwala_provider_billing_reference_unique.sql \
  20261026125000_doodhwala_provider_invoice_month_idempotency.sql; do
  apply "$PR71_DIR/$migration"
done
apply supabase/migrations/20261028100000_doodhwala_atomic_manual_checkout.sql
apply scripts/sql-tests/manual-ledger-separation-assertions.sql

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
pilot=supabase/deferred/20261028130000_billing_pilot_sponsorship.sql
# The uncorrected PR #71 invoice function must not unlock the new UI draft.
if psql -X -1 -v ON_ERROR_STOP=1 -f "$pilot" >"$work/pilot-out" 2>"$work/pilot-err"; then
  echo 'Expected uncorrected invoice function to fail the pilot preflight.' >&2; exit 1
fi
grep -Fq billing_function_drift_review_required "$work/pilot-err"
printf 'Synthetic pilot preflight rejected the uncorrected invoice function.\n'

apply supabase/deferred/20261028110000_provider_invoice_plan_conflict.sql
apply supabase/deferred/20261028110000_provider_invoice_plan_conflict.sql
apply scripts/sql-tests/manual-invoice-plan-conflict-assertions.sql

# Inherited or accidental browser grants must abort the entire draft transaction.
if psql -X -1 -v ON_ERROR_STOP=1 \
  -c 'grant execute on function public.admin_record_provider_subscription_payment(uuid,bigint,text,text,timestamptz,text) to anon' \
  -f "$pilot" >"$work/pilot-out" 2>"$work/pilot-err"; then
  echo 'Expected an anonymous billing grant to fail the pilot preflight.' >&2; exit 1
fi
grep -Fq billing_function_grants_review_required "$work/pilot-err"
printf 'Synthetic pilot preflight rejected an anonymous billing grant.\n'

if psql -X -1 -v ON_ERROR_STOP=1 \
  -c 'create role fixture_pilot_inherited nologin; grant fixture_pilot_inherited to authenticated; alter default privileges in schema private grant select on tables to fixture_pilot_inherited' \
  -f "$pilot" >"$work/pilot-out" 2>"$work/pilot-err"; then
  echo 'Expected inherited private-table privileges to fail the pilot preflight.' >&2; exit 1
fi
grep -Fq billing_pilot_private_table_grant_remains "$work/pilot-err"
printf 'Synthetic pilot preflight rejected inherited private-table privileges.\n'

prepare=supabase/deferred/20261028120000_prepare_inactive_seller_plans.sql
admin_setup="set role authenticated; select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000001',false); select set_config('request.jwt.claim.admin','true',false);"
nonadmin_setup="set role authenticated; select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',false); select set_config('request.jwt.claim.admin','false',false);"
marker="select set_config('doodhwala.disposable_pilot_fixture','yes',false);"
expect_prepare_failure() {
  local setup=$1 expected=$2
  if { printf '%s\n' "$setup"; cat "$prepare"; } | psql -X -1 -v ON_ERROR_STOP=1 >"$work/out" 2>"$work/err"; then
    echo "Expected plan preparation failure: $expected" >&2; exit 1
  fi
  if ! grep -Fq "$expected" "$work/err"; then
    cat "$work/err" >&2; exit 1
  fi
  printf 'Synthetic guard rejected: %s\n' "$expected"
}
run_prepare() {
  { printf '%s\n' "$admin_setup $marker"; cat "$prepare"; } | psql -X -1 -v ON_ERROR_STOP=1
}
expect_prepare_failure "$admin_setup" disposable_pilot_fixture_confirmation_required
expect_prepare_failure "$nonadmin_setup $marker" admin_access_required
run_prepare
run_prepare
apply scripts/sql-tests/inactive-seller-plan-assertions.sql

psql -X -v ON_ERROR_STOP=1 -c "update public.provider_billing_plans set is_active=true where name='Normal listing'"
expect_prepare_failure "$admin_setup $marker" seller_plan_catalog_conflict_review_required
psql -X -v ON_ERROR_STOP=1 <<'SQL'
do $$ begin
  if not exists (select 1 from public.provider_billing_plans where name='Normal listing' and is_active) then
    raise exception 'active_plan_was_silently_changed';
  end if;
end $$;
delete from public.provider_billing_plans where name='Normal listing';
update public.provider_billing_plans set amount_paise=12345 where name='Recommended and in-app advertising';
SQL
expect_prepare_failure "$admin_setup $marker" seller_plan_catalog_conflict_review_required
psql -X -v ON_ERROR_STOP=1 <<'SQL'
do $$ begin
  if exists (select 1 from public.provider_billing_plans where name='Normal listing') then
    raise exception 'partial_plan_preparation_survived_failure';
  end if;
end $$;
update public.provider_billing_plans set amount_paise=350000 where name='Recommended and in-app advertising';
SQL
run_prepare
psql -X -v ON_ERROR_STOP=1 -c "insert into public.provider_billing_plans(name,amount_paise,description,is_active) values('Normal listing',200000,'duplicate synthetic row',false)"
expect_prepare_failure "$admin_setup $marker" seller_plan_catalog_conflict_review_required
psql -X -v ON_ERROR_STOP=1 -c "delete from public.provider_billing_plans where description='duplicate synthetic row'"
apply scripts/sql-tests/inactive-seller-plan-assertions.sql
apply "$pilot"
apply scripts/sql-tests/sponsored-placement-assertions.sql
printf 'Synthetic PR #71 plan, manual billing and sponsored-placement checks passed. No real payments or entitlements were created.\n'
