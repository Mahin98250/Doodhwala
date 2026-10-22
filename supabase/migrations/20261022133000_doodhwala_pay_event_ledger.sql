-- Doodhwala Pay Phase 2: provider-event inbox and database-enforced state transitions.
-- This migration creates storage/guardrails only. It does not enable a provider or collect money.

create table if not exists public.payment_provider_events (
  id uuid primary key default gen_random_uuid(),
  gateway_name text not null check (length(trim(gateway_name)) between 1 and 80),
  gateway_event_id text not null check (length(trim(gateway_event_id)) between 1 and 200),
  event_type text not null check (length(trim(event_type)) between 1 and 120),
  payment_transaction_id uuid references public.payment_transactions(id) on delete restrict,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_status text not null default 'received'
    check (processing_status in ('received','processed','ignored','failed')),
  failure_code text,
  unique (gateway_name, gateway_event_id)
);

create index if not exists payment_provider_events_unprocessed_idx
  on public.payment_provider_events(received_at)
  where processing_status in ('received','failed');
create index if not exists payment_provider_events_transaction_idx
  on public.payment_provider_events(payment_transaction_id, received_at desc);

alter table public.payment_provider_events enable row level security;
revoke all on public.payment_provider_events from anon, authenticated;
grant select, insert, update, delete on public.payment_provider_events to service_role;

create or replace function public.doodhwala_pay_guard_state_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if not (
    (old.status = 'created' and new.status in ('pending_provider','failed','cancelled')) or
    (old.status = 'pending_provider' and new.status in ('authorized','captured','failed','cancelled')) or
    (old.status = 'authorized' and new.status in ('captured','failed','cancelled')) or
    (old.status = 'captured' and new.status = 'refund_pending') or
    (old.status = 'refund_pending' and new.status in ('refunded','captured'))
  ) then
    raise exception 'invalid_payment_status_transition:%:%', old.status, new.status
      using errcode = 'check_violation';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists payment_transactions_guard_state on public.payment_transactions;
create trigger payment_transactions_guard_state
before update of status on public.payment_transactions
for each row execute function public.doodhwala_pay_guard_state_transition();

revoke execute on function public.doodhwala_pay_guard_state_transition() from public, anon, authenticated;

comment on table public.payment_provider_events is
'Server-only webhook event inbox. Unique provider event IDs support replay/idempotency protection. Insert only after verifying provider signatures on raw request bytes.';
comment on function public.doodhwala_pay_guard_state_transition() is
'Restricts payment status changes to the documented server-side state machine. Does not verify provider signatures; webhook code must do that before any state transition.';
