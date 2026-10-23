-- Doodhwala Pay foundation: server-owned payment intent ledger.
-- This records payment attempts only; it does not move money or mark orders paid.
create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  customer_id uuid not null references auth.users(id) on delete restrict,
  provider_id uuid references public.provider_profiles(id) on delete set null,
  amount_paise bigint not null check (amount_paise > 0),
  currency text not null default 'INR' check (currency = 'INR'),
  method text not null check (method in ('upi','card','netbanking','wallet','cod')),
  status text not null default 'created' check (status in ('created','pending_provider','authorized','captured','failed','cancelled','refund_pending','refunded')),
  gateway_name text,
  gateway_order_id text,
  gateway_payment_id text,
  idempotency_key text not null,
  failure_code text,
  failure_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_id, idempotency_key),
  unique (gateway_name, gateway_payment_id)
);

create index if not exists payment_transactions_order_created_idx
  on public.payment_transactions(order_id, created_at desc);
create index if not exists payment_transactions_customer_created_idx
  on public.payment_transactions(customer_id, created_at desc);

alter table public.payment_transactions enable row level security;
revoke all on public.payment_transactions from anon, authenticated;
grant select, insert, update, delete on public.payment_transactions to service_role;

create or replace function public.doodhwala_pay_touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists payment_transactions_touch_updated_at on public.payment_transactions;
create trigger payment_transactions_touch_updated_at
before update on public.payment_transactions
for each row execute function public.doodhwala_pay_touch_updated_at();

comment on table public.payment_transactions is
'Server-owned payment intent ledger. Never store card numbers, CVV, UPI PINs, or banking credentials. A transaction is not paid until a trusted provider webhook confirms capture.';
