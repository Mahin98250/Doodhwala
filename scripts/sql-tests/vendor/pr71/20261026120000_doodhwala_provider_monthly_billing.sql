-- Separate ledger for provider fees owed to Doodhwala.
-- Customer milk-order funds remain 100% payable directly to the milk provider.
create table if not exists public.provider_billing_plans (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(trim(name)) between 2 and 80),
 amount_paise bigint not null check(amount_paise > 0),
 billing_interval text not null default 'month' check(billing_interval='month'),
 description text not null default '',
 is_active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.provider_subscription_invoices (
 id uuid primary key default gen_random_uuid(),
 provider_id uuid not null references public.provider_profiles(id) on delete restrict,
 plan_id uuid references public.provider_billing_plans(id) on delete set null,
 plan_name_snapshot text not null,
 amount_paise bigint not null check(amount_paise > 0),
 currency text not null default 'INR' check(currency='INR'),
 period_start date not null,
 period_end date not null,
 due_date date not null,
 status text not null default 'due' check(status in ('due','paid','void')),
 invoice_number text not null unique,
 notes text not null default '',
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 paid_at timestamptz,
 voided_at timestamptz,
 check(period_end >= period_start),
 check((status='paid') = (paid_at is not null)),
 check((status='void') = (voided_at is not null))
);
create index if not exists provider_subscription_invoices_provider_period_idx
 on public.provider_subscription_invoices(provider_id,period_start desc,created_at desc);
create index if not exists provider_subscription_invoices_due_idx
 on public.provider_subscription_invoices(status,due_date) where status='due';
create table if not exists public.provider_subscription_payments (
 id uuid primary key default gen_random_uuid(),
 invoice_id uuid not null references public.provider_subscription_invoices(id) on delete restrict,
 provider_id uuid not null references public.provider_profiles(id) on delete restrict,
 amount_paise bigint not null check(amount_paise > 0),
 method text not null default 'manual_upi' check(method in ('manual_upi','bank_transfer','cash')),
 reference text not null check(length(trim(reference)) between 3 and 120),
 received_at timestamptz not null default now(),
 recorded_by uuid references auth.users(id) on delete set null,
 notes text not null default '',
 created_at timestamptz not null default now(),
 unique(method,reference)
);
create index if not exists provider_subscription_payments_invoice_idx
 on public.provider_subscription_payments(invoice_id,created_at desc);
create table if not exists public.provider_billing_settings (
 singleton boolean primary key default true check(singleton),
 payee_name text not null default '',
 upi_id text not null default '',
 instructions text not null default 'Pay the exact invoice amount and include the invoice number in the payment note.',
 updated_by uuid references auth.users(id) on delete set null,
 updated_at timestamptz not null default now(),
 check(length(payee_name)<=120),
 check(length(upi_id)<=255),
 check(length(instructions)<=1000)
);
alter table public.provider_billing_plans enable row level security;
alter table public.provider_subscription_invoices enable row level security;
alter table public.provider_subscription_payments enable row level security;
alter table public.provider_billing_settings enable row level security;
revoke all on public.provider_billing_plans from anon,authenticated;
revoke all on public.provider_subscription_invoices from anon,authenticated;
revoke all on public.provider_subscription_payments from anon,authenticated;
revoke all on public.provider_billing_settings from anon,authenticated;
grant select on public.provider_billing_plans to authenticated;
grant select on public.provider_subscription_invoices to authenticated;
grant select on public.provider_subscription_payments to authenticated;
create policy provider_billing_plans_active_read on public.provider_billing_plans
 for select to authenticated using(is_active or private.is_current_user_admin());
create policy provider_subscription_invoice_owner_read on public.provider_subscription_invoices
 for select to authenticated using(private.is_current_user_admin() or exists(
  select 1 from public.provider_profiles p where p.id=provider_subscription_invoices.provider_id and p.owner_user_id=(select auth.uid())
 ));
create policy provider_subscription_payment_owner_read on public.provider_subscription_payments
 for select to authenticated using(private.is_current_user_admin() or exists(
  select 1 from public.provider_profiles p where p.id=provider_subscription_payments.provider_id and p.owner_user_id=(select auth.uid())
 ));
comment on table public.provider_subscription_invoices is 'Fixed provider subscription fees owed to Doodhwala; separate from customer milk order payments.';
comment on table public.provider_subscription_payments is 'Manually reconciled provider payments to Doodhwala. This record is not independent bank verification.';
