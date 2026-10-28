-- DISPOSABLE TEST DRAFT ONLY. NOT AN AUTOMATIC MIGRATION. DO NOT RUN IN PRODUCTION.
-- Depends on the reviewed PR #71 billing schema AND the deferred invoice-plan
-- conflict fix. Reconcile deployed schema/history, real grants, terms, taxes,
-- billing periods, advertising rules, reversal handling and rollback before
-- considering a staged rollout. Applying this draft does not activate billing,
-- create invoices, accept money, or publish any sponsored placement.
--
-- The UI flags below default to FALSE and are not writable by browser roles.
-- They are rollout switches, not an authorization boundary for legacy PR #71
-- admin RPCs: those RPCs must separately enforce their admin authorization.
-- Any eventual flag change requires a separately approved owner procedure.

-- Fail rather than reusing an unfamiliar function, constraint or draft table.
do $preflight$
declare
  v_invoice oid := to_regprocedure('public.admin_create_provider_subscription_invoice(uuid,uuid,date,date,date,text,text)');
  v_payment oid := to_regprocedure('public.admin_record_provider_subscription_payment(uuid,bigint,text,text,timestamptz,text)');
begin
  if to_regclass('public.provider_billing_plans') is null
     or to_regclass('public.provider_subscription_invoices') is null
     or to_regclass('public.provider_subscription_payments') is null
     or to_regclass('public.provider_profiles') is null
     or to_regclass('public.provider_verifications') is null
     or to_regclass('public.provider_service_areas') is null
     or to_regprocedure('public.provider_get_my_billing()') is null
     or v_invoice is null or v_payment is null then
    raise exception 'reviewed_provider_billing_pr71_required';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_proc p
    where p.oid=to_regprocedure('public.provider_get_my_billing()')
      and p.prosecdef and p.proconfig=array['search_path=""']::text[]
      and md5(p.prosrc)='04655ff3ab4b294739a03cfba731891a'
  ) or not exists (
    select 1 from pg_catalog.pg_proc p
    where p.oid=v_invoice and p.prosecdef and p.proconfig=array['search_path=""']::text[]
      and md5(p.prosrc)='bfbc4978f2810a252c35de1ab554e9fd'
  ) or not exists (
    select 1 from pg_catalog.pg_proc p
    where p.oid=v_payment and p.prosecdef and p.proconfig=array['search_path=""']::text[]
      and md5(p.prosrc)='5a5b227eba96383b17cc55b7c625fd5f'
  ) then
    raise exception 'billing_function_drift_review_required';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid='public.provider_subscription_invoices'::regclass
      and conname='provider_subscription_invoices_provider_month_unique'
      and contype='u' and not condeferrable
      and pg_get_constraintdef(oid)='UNIQUE (provider_id, period_start)'
  ) then
    raise exception 'billing_month_constraint_review_required';
  end if;
  if has_function_privilege('anon',v_invoice,'execute')
     or has_function_privilege('anon',v_payment,'execute')
     or not has_function_privilege('authenticated',v_invoice,'execute')
     or not has_function_privilege('authenticated',v_payment,'execute') then
    raise exception 'billing_function_grants_review_required';
  end if;
  if to_regclass('private.provider_billing_pilot_control') is not null
     or to_regclass('private.provider_sponsored_placements') is not null
     or to_regclass('private.provider_sponsored_placement_events') is not null
     or to_regprocedure('public.get_sponsored_provider_cards(uuid[])') is not null
     or to_regprocedure('public.get_provider_billing_pilot_ui_state()') is not null
     or to_regprocedure('public.provider_get_billing_for_dashboard(uuid)') is not null
     or to_regprocedure('public.admin_set_sponsored_placement(uuid,boolean)') is not null then
    raise exception 'billing_pilot_existing_objects_review_required';
  end if;
end
$preflight$;

create table private.provider_billing_pilot_control (
  singleton boolean primary key default true check(singleton),
  billing_ui_enabled boolean not null default false,
  sponsored_ui_enabled boolean not null default false
);
insert into private.provider_billing_pilot_control(singleton) values(true);

-- A placement is an admin's explicit approval, never a second billing ledger.
-- Its eligibility is rechecked against the original invoice and payment on
-- every public read. Deactivation is allowed even when the rollout is disabled.
create table private.provider_sponsored_placements (
  invoice_id uuid primary key references public.provider_subscription_invoices(id) on delete restrict,
  enabled boolean not null default false,
  updated_by uuid not null references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now()
);
create table private.provider_sponsored_placement_events (
  id bigint generated always as identity primary key,
  invoice_id uuid not null references public.provider_subscription_invoices(id) on delete restrict,
  enabled boolean not null,
  actor_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
revoke all on private.provider_billing_pilot_control, private.provider_sponsored_placements,
  private.provider_sponsored_placement_events from public, anon, authenticated;
revoke all on sequence private.provider_sponsored_placement_events_id_seq from public, anon, authenticated;

-- Compatibility/rollout check, NOT a substitute for security review. Exact
-- fingerprints make later source changes fail closed instead of silently
-- enabling an unfamiliar implementation. The private control table is writable
-- only by the database owner or another separately privileged operator.
create function private.provider_billing_pilot_ready()
returns boolean language sql stable security definer set search_path='' as $$
  select coalesce((select c.billing_ui_enabled from private.provider_billing_pilot_control c where c.singleton), false)
    and exists (
      select 1 from pg_catalog.pg_proc p
      where p.oid=to_regprocedure('public.admin_create_provider_subscription_invoice(uuid,uuid,date,date,date,text,text)')
        and p.prosecdef and p.proconfig=array['search_path=""']::text[]
        and md5(p.prosrc)='bfbc4978f2810a252c35de1ab554e9fd'
    )
    and exists (
      select 1 from pg_catalog.pg_proc p
      where p.oid=to_regprocedure('public.admin_record_provider_subscription_payment(uuid,bigint,text,text,timestamptz,text)')
        and p.prosecdef and p.proconfig=array['search_path=""']::text[]
        and md5(p.prosrc)='5a5b227eba96383b17cc55b7c625fd5f'
    )
    and exists (
      select 1 from pg_catalog.pg_proc p
      where p.oid=to_regprocedure('public.provider_get_my_billing()')
        and p.prosecdef and p.proconfig=array['search_path=""']::text[]
        and md5(p.prosrc)='04655ff3ab4b294739a03cfba731891a'
    )
    and exists (
      select 1 from pg_catalog.pg_constraint c
      where c.conrelid=to_regclass('public.provider_subscription_invoices')
        and c.conname='provider_subscription_invoices_provider_month_unique'
        and c.contype='u' and not c.condeferrable
        and pg_get_constraintdef(c.oid)='UNIQUE (provider_id, period_start)'
    )
    and not coalesce(has_function_privilege('anon',to_regprocedure('public.admin_create_provider_subscription_invoice(uuid,uuid,date,date,date,text,text)'),'execute'),true)
    and not coalesce(has_function_privilege('anon',to_regprocedure('public.admin_record_provider_subscription_payment(uuid,bigint,text,text,timestamptz,text)'),'execute'),true)
$$;
revoke all on function private.provider_billing_pilot_ready() from public, anon, authenticated;

create function public.get_provider_billing_pilot_ui_state()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  return jsonb_build_object(
    'billing_ui_enabled',private.provider_billing_pilot_ready(),
    'sponsored_ui_enabled',private.provider_billing_pilot_ready()
      and coalesce((select c.sponsored_ui_enabled from private.provider_billing_pilot_control c where c.singleton),false)
  );
end $$;
revoke all on function public.get_provider_billing_pilot_ui_state() from public, anon, authenticated;
grant execute on function public.get_provider_billing_pilot_ui_state() to authenticated;

-- PR #71's reader picks the newest owned provider, while the dashboard reader
-- uses an unordered first provider. Reject multi-profile accounts rather than
-- displaying billing for a different profile. A future explicitly scoped reader
-- should replace this conservative compatibility wrapper after review.
create function public.provider_get_billing_for_dashboard(p_provider_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if p_provider_id is null or not exists (
    select 1 from public.provider_profiles p where p.id=p_provider_id and p.owner_user_id=auth.uid()
  ) then raise exception 'provider_not_found_or_not_owner'; end if;
  if (select count(*) from public.provider_profiles p where p.owner_user_id=auth.uid()) <> 1 then
    raise exception 'billing_provider_scope_requires_review';
  end if;
  if not private.provider_billing_pilot_ready() then raise exception 'billing_pilot_not_enabled'; end if;
  return public.provider_get_my_billing();
end $$;
revoke all on function public.provider_get_billing_for_dashboard(uuid) from public, anon, authenticated;
grant execute on function public.provider_get_billing_for_dashboard(uuid) to authenticated;

create function public.admin_set_sponsored_placement(p_invoice_id uuid, p_enabled boolean)
returns boolean language plpgsql security definer set search_path='' as $$
declare
  v_invoice public.provider_subscription_invoices%rowtype;
  v_previous boolean;
  v_today date := (statement_timestamp() at time zone 'Asia/Kolkata')::date;
begin
  if auth.uid() is null or not coalesce(private.is_current_user_admin(),false) then
    raise exception 'admin_access_required';
  end if;
  if p_invoice_id is null or p_enabled is null then raise exception 'invalid_placement_request'; end if;
  -- Locking the invoice serializes placement approval with payment/status changes.
  select * into v_invoice from public.provider_subscription_invoices i where i.id=p_invoice_id for update;
  if not found then raise exception 'invoice_not_found'; end if;
  if p_enabled then
    if not private.provider_billing_pilot_ready()
       or not coalesce((select c.sponsored_ui_enabled from private.provider_billing_pilot_control c where c.singleton),false) then
      raise exception 'sponsored_pilot_not_enabled';
    end if;
    if v_invoice.status <> 'paid' or v_invoice.paid_at is null
       or v_invoice.currency <> 'INR' or v_invoice.amount_paise <> 350000
       or v_invoice.plan_name_snapshot <> 'Recommended and in-app advertising'
       or v_today not between v_invoice.period_start and v_invoice.period_end
       or not exists (
         select 1 from public.provider_billing_plans p where p.id=v_invoice.plan_id
           and p.name='Recommended and in-app advertising' and p.amount_paise=350000
           and p.billing_interval='month'
       ) or not exists (
         select 1 from public.provider_subscription_payments p
         where p.invoice_id=v_invoice.id and p.provider_id=v_invoice.provider_id
           and p.amount_paise=v_invoice.amount_paise and p.received_at<=statement_timestamp()
       ) or not exists (
         select 1 from public.provider_profiles p where p.id=v_invoice.provider_id and p.is_active
           and exists (select 1 from public.provider_verifications v where v.provider_id=p.id and v.status='approved')
           and exists (select 1 from public.provider_service_areas a where a.provider_id=p.id)
       ) then
      raise exception 'paid_premium_invoice_required';
    end if;
  end if;
  select enabled into v_previous from private.provider_sponsored_placements where invoice_id=p_invoice_id;
  if coalesce(v_previous,false)=p_enabled then return true; end if;
  insert into private.provider_sponsored_placements(invoice_id,enabled,updated_by,updated_at)
  values(p_invoice_id,p_enabled,auth.uid(),now())
  on conflict(invoice_id) do update set enabled=excluded.enabled,updated_by=excluded.updated_by,updated_at=excluded.updated_at;
  insert into private.provider_sponsored_placement_events(invoice_id,enabled,actor_id)
  values(p_invoice_id,p_enabled,auth.uid());
  return true;
end $$;
revoke all on function public.admin_set_sponsored_placement(uuid,boolean) from public, anon, authenticated;
grant execute on function public.admin_set_sponsored_placement(uuid,boolean) to authenticated;

-- Only server-approved IDs among the requested, already-discovered seller cards
-- are returned. No invoice, payment reference or buyer/seller private data is
-- exposed. The UI must discard responses on failure and at expires_at.
create function public.get_sponsored_provider_cards(p_provider_ids uuid[])
returns table(provider_id uuid, expires_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if p_provider_ids is null or cardinality(p_provider_ids)=0 then return; end if;
  if cardinality(p_provider_ids)>100 then raise exception 'too_many_provider_ids'; end if;
  if not private.provider_billing_pilot_ready()
     or not coalesce((select c.sponsored_ui_enabled from private.provider_billing_pilot_control c where c.singleton),false) then
    return;
  end if;
  return query
  select distinct i.provider_id, ((i.period_end+1)::timestamp at time zone 'Asia/Kolkata')
  from private.provider_sponsored_placements s
  join public.provider_subscription_invoices i on i.id=s.invoice_id
  join public.provider_billing_plans plan on plan.id=i.plan_id
  join public.provider_profiles provider on provider.id=i.provider_id
  where s.enabled and i.provider_id=any(p_provider_ids) and provider.is_active
    and exists (select 1 from public.provider_verifications v where v.provider_id=provider.id and v.status='approved')
    and exists (select 1 from public.provider_service_areas a where a.provider_id=provider.id)
    and i.status='paid' and i.paid_at is not null and i.currency='INR' and i.amount_paise=350000
    and i.plan_name_snapshot='Recommended and in-app advertising'
    and plan.name='Recommended and in-app advertising' and plan.amount_paise=350000
    and plan.billing_interval='month'
    and (statement_timestamp() at time zone 'Asia/Kolkata')::date between i.period_start and i.period_end
    and exists (select 1 from public.provider_subscription_payments p
                where p.invoice_id=i.id and p.provider_id=i.provider_id
                  and p.amount_paise=i.amount_paise and p.received_at<=statement_timestamp());
end $$;
revoke all on function public.get_sponsored_provider_cards(uuid[]) from public, anon, authenticated;
grant execute on function public.get_sponsored_provider_cards(uuid[]) to anon, authenticated;

-- Abort if an inherited browser-role grant would make private rollout/placement
-- tables directly readable or writable. Definer RPCs remain the only UI path.
do $privilege_check$
declare v_role text; v_table text; v_priv text;
begin
  foreach v_role in array array['anon','authenticated'] loop
    foreach v_table in array array['private.provider_billing_pilot_control','private.provider_sponsored_placements','private.provider_sponsored_placement_events'] loop
      foreach v_priv in array array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] loop
        if has_table_privilege(v_role,v_table,v_priv) then
          raise exception 'billing_pilot_private_table_grant_remains: % % %',v_role,v_table,v_priv;
        end if;
      end loop;
    end loop;
  end loop;
end
$privilege_check$;
