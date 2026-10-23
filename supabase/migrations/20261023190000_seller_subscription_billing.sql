-- Doodhwala seller subscription billing.
-- Source migration only: test on isolated staging before production deployment.
create extension if not exists pgcrypto;

create table if not exists public.seller_subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z][a-z0-9_]{1,39}$'),
  name text not null check (length(trim(name)) between 2 and 80),
  monthly_price_paise bigint not null check (monthly_price_paise between 100 and 100000000),
  description text not null default '',
  featured_placement boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.seller_subscriptions (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.provider_profiles(id) on delete restrict,
  plan_id uuid not null references public.seller_subscription_plans(id) on delete restrict,
  status text not null default 'pending_payment'
    check (status in ('pending_payment','active','past_due','expired','cancelled','suspended')),
  agreed_price_paise bigint not null check (agreed_price_paise > 0),
  starts_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status <> 'active') or (starts_at is not null and expires_at is not null and expires_at > starts_at))
);
create index if not exists seller_subscriptions_provider_status_idx
  on public.seller_subscriptions(provider_id,status,expires_at desc);
create index if not exists seller_subscriptions_expiry_idx
  on public.seller_subscriptions(status,expires_at);

create table if not exists public.seller_subscription_payments (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.seller_subscriptions(id) on delete restrict,
  provider_id uuid not null references public.provider_profiles(id) on delete restrict,
  amount_paise bigint not null check (amount_paise > 0),
  currency text not null default 'INR' check (currency = 'INR'),
  payment_method text not null check (payment_method in ('online','offline_cash','offline_upi','offline_bank_transfer','offline_other')),
  status text not null default 'pending' check (status in ('pending','succeeded','failed','refunded','reversed')),
  provider_reference text,
  idempotency_key text not null unique,
  collected_by uuid references auth.users(id) on delete set null,
  collection_note text,
  paid_at timestamptz,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists seller_subscription_payments_provider_idx
  on public.seller_subscription_payments(provider_id,created_at desc);
create index if not exists seller_subscription_payments_status_idx
  on public.seller_subscription_payments(status,created_at desc);

create table if not exists public.seller_subscription_audit (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  provider_id uuid references public.provider_profiles(id) on delete set null,
  subscription_id uuid references public.seller_subscriptions(id) on delete set null,
  payment_id uuid references public.seller_subscription_payments(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists seller_subscription_audit_created_idx
  on public.seller_subscription_audit(created_at desc);

alter table public.seller_subscription_plans enable row level security;
alter table public.seller_subscriptions enable row level security;
alter table public.seller_subscription_payments enable row level security;
alter table public.seller_subscription_audit enable row level security;
revoke all on public.seller_subscription_plans, public.seller_subscriptions,
  public.seller_subscription_payments, public.seller_subscription_audit from anon, authenticated;
grant select on public.seller_subscription_plans to authenticated;
grant select on public.seller_subscriptions, public.seller_subscription_payments to authenticated;
-- No direct policies are provided: all writes and private reads go through owner-checked RPCs.

insert into public.seller_subscription_plans(code,name,monthly_price_paise,description,featured_placement,is_active)
values
 ('basic','Basic',200000,'Standard dairy listing and marketplace access.',false,true),
 ('featured','Featured',300000,'Standard listing plus featured in-app promotion.',true,true)
on conflict (code) do nothing;

create or replace function public.seller_get_subscription_billing()
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_provider_id uuid;
  v_result jsonb;
begin
  if v_uid is null then raise exception 'Sign in required'; end if;
  select id into v_provider_id from public.provider_profiles where owner_user_id = v_uid;
  if v_provider_id is null then raise exception 'Create your seller profile first'; end if;

  select jsonb_build_object(
    'plans', coalesce((select jsonb_agg(jsonb_build_object(
      'id',p.id,'code',p.code,'name',p.name,'monthly_price_paise',p.monthly_price_paise,
      'description',p.description,'featured_placement',p.featured_placement
    ) order by p.monthly_price_paise) from public.seller_subscription_plans p where p.is_active), '[]'::jsonb),
    'subscriptions', coalesce((select jsonb_agg(jsonb_build_object(
      'id',s.id,'plan_name',p.name,'plan_code',p.code,'status',s.status,
      'agreed_price_paise',s.agreed_price_paise,'starts_at',s.starts_at,'expires_at',s.expires_at,
      'featured_placement',p.featured_placement,'created_at',s.created_at
    ) order by s.created_at desc) from public.seller_subscriptions s
      join public.seller_subscription_plans p on p.id=s.plan_id
      where s.provider_id=v_provider_id), '[]'::jsonb),
    'payments', coalesce((select jsonb_agg(jsonb_build_object(
      'id',pay.id,'subscription_id',pay.subscription_id,'amount_paise',pay.amount_paise,
      'payment_method',pay.payment_method,'status',pay.status,'provider_reference',pay.provider_reference,
      'paid_at',pay.paid_at,'created_at',pay.created_at
    ) order by pay.created_at desc) from public.seller_subscription_payments pay
      where pay.provider_id=v_provider_id), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;
revoke all on function public.seller_get_subscription_billing() from public, anon;
grant execute on function public.seller_get_subscription_billing() to authenticated;

create or replace function public.seller_request_subscription(p_plan_id uuid, p_payment_method text)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_provider_id uuid;
  v_plan public.seller_subscription_plans%rowtype;
  v_subscription_id uuid;
  v_payment_id uuid;
begin
  if v_uid is null then raise exception 'Sign in required'; end if;
  select id into v_provider_id from public.provider_profiles where owner_user_id=v_uid;
  if v_provider_id is null then raise exception 'Create your seller profile first'; end if;
  if p_payment_method not in ('offline_cash','offline_upi','offline_bank_transfer','offline_other','online') then
    raise exception 'Unsupported payment method';
  end if;
  if p_payment_method='online' then
    raise exception 'Online checkout is not configured yet. Please request offline collection.';
  end if;
  select * into v_plan from public.seller_subscription_plans where id=p_plan_id and is_active=true;
  if not found then raise exception 'This plan is unavailable'; end if;

  -- Avoid multiple open billing requests for the same seller.
  if exists(select 1 from public.seller_subscription_payments pay
    where pay.provider_id=v_provider_id and pay.status='pending'
      and pay.payment_method like 'offline_%') then
    raise exception 'You already have a pending collection request. Contact Doodhwala to update it.';
  end if;

  insert into public.seller_subscriptions(provider_id,plan_id,status,agreed_price_paise)
  values(v_provider_id,v_plan.id,'pending_payment',v_plan.monthly_price_paise)
  returning id into v_subscription_id;

  insert into public.seller_subscription_payments(subscription_id,provider_id,amount_paise,payment_method,idempotency_key,created_by)
  values(v_subscription_id,v_provider_id,v_plan.monthly_price_paise,p_payment_method,gen_random_uuid()::text,v_uid)
  returning id into v_payment_id;

  insert into public.seller_subscription_audit(actor_user_id,provider_id,subscription_id,payment_id,action,details)
  values(v_uid,v_provider_id,v_subscription_id,v_payment_id,'offline_collection_requested',
    jsonb_build_object('plan_code',v_plan.code,'amount_paise',v_plan.monthly_price_paise,'method',p_payment_method));
  return jsonb_build_object('subscription_id',v_subscription_id,'payment_id',v_payment_id,'status','pending','message','Collection request recorded. Doodhwala must confirm receipt before activation.');
end;
$$;
revoke all on function public.seller_request_subscription(uuid,text) from public, anon;
grant execute on function public.seller_request_subscription(uuid,text) to authenticated;

create or replace function public.admin_list_seller_subscription_billing(p_limit integer default 100)
returns table (
  payment_id uuid, subscription_id uuid, provider_id uuid, provider_name text, owner_name text,
  plan_name text, amount_paise bigint, payment_method text, payment_status text,
  subscription_status text, created_at timestamptz, paid_at timestamptz,
  provider_reference text, collection_note text
)
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if not coalesce(public.is_current_user_admin(),false) then raise exception 'Owner access required'; end if;
  return query
  select pay.id,s.id,pp.id,pp.display_name,pp.owner_name,pl.name,pay.amount_paise,
    pay.payment_method,pay.status,s.status,pay.created_at,pay.paid_at,pay.provider_reference,pay.collection_note
  from public.seller_subscription_payments pay
  join public.seller_subscriptions s on s.id=pay.subscription_id
  join public.provider_profiles pp on pp.id=s.provider_id
  join public.seller_subscription_plans pl on pl.id=s.plan_id
  order by (pay.status='pending') desc,pay.created_at desc
  limit greatest(1,least(coalesce(p_limit,100),250));
end;
$$;
revoke all on function public.admin_list_seller_subscription_billing(integer) from public, anon;
grant execute on function public.admin_list_seller_subscription_billing(integer) to authenticated;

create or replace function public.admin_list_seller_subscription_plans()
returns table(id uuid,code text,name text,monthly_price_paise bigint,description text,featured_placement boolean,is_active boolean)
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if not coalesce(public.is_current_user_admin(),false) then raise exception 'Owner access required'; end if;
  return query select p.id,p.code,p.name,p.monthly_price_paise,p.description,p.featured_placement,p.is_active
    from public.seller_subscription_plans p order by p.monthly_price_paise,p.name;
end;
$$;
revoke all on function public.admin_list_seller_subscription_plans() from public, anon;
grant execute on function public.admin_list_seller_subscription_plans() to authenticated;

create or replace function public.admin_upsert_seller_subscription_plan(
  p_id uuid, p_code text, p_name text, p_monthly_price_paise bigint,
  p_description text, p_featured_placement boolean, p_is_active boolean
)
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare v_id uuid;
begin
  if not coalesce(public.is_current_user_admin(),false) then raise exception 'Owner access required'; end if;
  if p_code !~ '^[a-z][a-z0-9_]{1,39}$' or length(trim(p_name)) not between 2 and 80
    or p_monthly_price_paise not between 100 and 100000000 then raise exception 'Invalid plan details'; end if;
  if p_id is null then
    insert into public.seller_subscription_plans(code,name,monthly_price_paise,description,featured_placement,is_active)
    values(p_code,trim(p_name),p_monthly_price_paise,left(coalesce(p_description,''),500),p_featured_placement,p_is_active)
    returning id into v_id;
  else
    update public.seller_subscription_plans set code=p_code,name=trim(p_name),
      monthly_price_paise=p_monthly_price_paise,description=left(coalesce(p_description,''),500),
      featured_placement=p_featured_placement,is_active=p_is_active,updated_at=now()
    where id=p_id returning id into v_id;
    if v_id is null then raise exception 'Plan not found'; end if;
  end if;
  insert into public.seller_subscription_audit(actor_user_id,action,details)
  values(auth.uid(),'seller_plan_updated',jsonb_build_object('plan_id',v_id,'code',p_code,'price_paise',p_monthly_price_paise,'featured',p_featured_placement,'active',p_is_active));
  return v_id;
end;
$$;
revoke all on function public.admin_upsert_seller_subscription_plan(uuid,text,text,bigint,text,boolean,boolean) from public, anon;
grant execute on function public.admin_upsert_seller_subscription_plan(uuid,text,text,bigint,text,boolean,boolean) to authenticated;

create or replace function public.admin_record_offline_seller_subscription_payment(
  p_payment_id uuid, p_amount_paise bigint, p_method text, p_reference text default null, p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_pay public.seller_subscription_payments%rowtype;
  v_sub public.seller_subscriptions%rowtype;
  v_now timestamptz := now();
  v_period_start timestamptz;
begin
  if not coalesce(public.is_current_user_admin(),false) then raise exception 'Owner access required'; end if;
  if p_method not in ('offline_cash','offline_upi','offline_bank_transfer','offline_other') then
    raise exception 'Only verified offline collections can be recorded here'; end if;
  select * into v_pay from public.seller_subscription_payments where id=p_payment_id for update;
  if not found then raise exception 'Payment record not found'; end if;
  if v_pay.status <> 'pending' or v_pay.payment_method not like 'offline_%' then
    raise exception 'Only pending offline collection requests can be marked paid'; end if;
  if p_amount_paise is distinct from v_pay.amount_paise then raise exception 'Collected amount must match the requested amount'; end if;
  select * into v_sub from public.seller_subscriptions where id=v_pay.subscription_id for update;
  update public.seller_subscription_payments set status='succeeded',payment_method=p_method,
    provider_reference=nullif(left(coalesce(p_reference,''),160),''),collection_note=nullif(left(coalesce(p_note,''),1000),''),
    collected_by=auth.uid(),paid_at=v_now,updated_at=v_now where id=v_pay.id;
  select greatest(v_now,coalesce(max(expires_at) filter (where status='active' and expires_at>v_now),v_now))
    into v_period_start from public.seller_subscriptions where provider_id=v_pay.provider_id and id<>v_sub.id;
  update public.seller_subscriptions set status='active',starts_at=v_period_start,expires_at=v_period_start+interval '1 month',updated_at=v_now
    where id=v_sub.id;
  insert into public.seller_subscription_audit(actor_user_id,provider_id,subscription_id,payment_id,action,details)
  values(auth.uid(),v_pay.provider_id,v_sub.id,v_pay.id,'offline_collection_confirmed',
    jsonb_build_object('amount_paise',v_pay.amount_paise,'method',p_method,'reference',left(coalesce(p_reference,''),160)));
  return jsonb_build_object('payment_id',v_pay.id,'subscription_id',v_sub.id,'payment_status','succeeded','subscription_status','active','starts_at',v_period_start,'expires_at',v_period_start+interval '1 month');
end;
$$;
revoke all on function public.admin_record_offline_seller_subscription_payment(uuid,bigint,text,text,text) from public, anon;
grant execute on function public.admin_record_offline_seller_subscription_payment(uuid,bigint,text,text,text) to authenticated;

create or replace function public.admin_list_seller_subscription_audit(p_limit integer default 100)
returns table(id bigint,actor_user_id uuid,provider_id uuid,subscription_id uuid,payment_id uuid,action text,details jsonb,created_at timestamptz)
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if not coalesce(public.is_current_user_admin(),false) then raise exception 'Owner access required'; end if;
  return query select a.id,a.actor_user_id,a.provider_id,a.subscription_id,a.payment_id,a.action,a.details,a.created_at
    from public.seller_subscription_audit a order by a.created_at desc limit greatest(1,least(coalesce(p_limit,100),500));
end;
$$;
revoke all on function public.admin_list_seller_subscription_audit(integer) from public, anon;
grant execute on function public.admin_list_seller_subscription_audit(integer) to authenticated;
