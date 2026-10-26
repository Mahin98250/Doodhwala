-- A real bank/UPI reference must not be reconciled to two invoices, even if
-- an operator accidentally selects different payment-method labels.
alter table public.provider_subscription_payments
  drop constraint if exists provider_subscription_payments_method_reference_key;
create unique index if not exists provider_subscription_payments_reference_unique_idx
  on public.provider_subscription_payments(reference);
