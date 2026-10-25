-- Cover the nullable actor_user_id foreign key in the append-only payment audit.
CREATE INDEX IF NOT EXISTS order_payment_events_actor_user_idx
  ON public.order_payment_events (actor_user_id);
