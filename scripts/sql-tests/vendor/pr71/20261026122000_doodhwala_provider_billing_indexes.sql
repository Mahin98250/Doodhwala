-- Cover the foreign keys identified by Supabase's staging performance advisor.
create index if not exists provider_subscription_invoices_plan_id_idx
 on public.provider_subscription_invoices(plan_id) where plan_id is not null;
create index if not exists provider_subscription_invoices_created_by_idx
 on public.provider_subscription_invoices(created_by) where created_by is not null;
create index if not exists provider_subscription_payments_provider_idx
 on public.provider_subscription_payments(provider_id,created_at desc);
create index if not exists provider_subscription_payments_recorded_by_idx
 on public.provider_subscription_payments(recorded_by) where recorded_by is not null;
create index if not exists provider_billing_settings_updated_by_idx
 on public.provider_billing_settings(updated_by) where updated_by is not null;
