-- Cover the new payment-related foreign keys for lower-cost deletes/updates
-- and better joins as staging order/payment history grows.
CREATE INDEX IF NOT EXISTS orders_payment_confirmed_by_idx
  ON public.orders (payment_confirmed_by);

CREATE INDEX IF NOT EXISTS payment_transactions_provider_id_idx
  ON public.payment_transactions (provider_id);
