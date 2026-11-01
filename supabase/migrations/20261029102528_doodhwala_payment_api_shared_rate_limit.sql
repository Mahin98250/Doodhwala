-- Shared authenticated-user rate limit for the payment Edge Function.
-- Unlike process-local maps, this row-level counter is enforced across Edge Function isolates.
-- The table and RPC are callable only by service_role, never by browser roles.

create table if not exists public.doodhwala_payment_api_rate_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_started_at timestamptz not null,
  request_count bigint not null check (request_count >= 0),
  last_seen_at timestamptz not null
);

create index if not exists doodhwala_payment_api_rate_limits_last_seen_idx
  on public.doodhwala_payment_api_rate_limits(last_seen_at);

alter table public.doodhwala_payment_api_rate_limits enable row level security;
revoke all on public.doodhwala_payment_api_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on public.doodhwala_payment_api_rate_limits to service_role;

create or replace function public.doodhwala_payment_api_allow_request(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_allowed boolean;
begin
  if p_user_id is null then
    raise exception 'rate_limit_user_required';
  end if;

  -- Atomic UPSERT serializes concurrent requests for one user. The first 30
  -- requests in a 60-second window are allowed; every later request is denied.
  insert into public.doodhwala_payment_api_rate_limits as limits(
    user_id, window_started_at, request_count, last_seen_at
  ) values (
    p_user_id, v_now, 1, v_now
  )
  on conflict (user_id) do update set
    window_started_at = case
      when v_now >= limits.window_started_at + interval '60 seconds' then v_now
      else limits.window_started_at
    end,
    request_count = case
      when v_now >= limits.window_started_at + interval '60 seconds' then 1
      else limits.request_count + 1
    end,
    last_seen_at = v_now
  returning limits.request_count <= 30 into v_allowed;

  return coalesce(v_allowed, false);
end
$$;

revoke all on function public.doodhwala_payment_api_allow_request(uuid)
  from public, anon, authenticated;
grant execute on function public.doodhwala_payment_api_allow_request(uuid)
  to service_role;

comment on table public.doodhwala_payment_api_rate_limits is
  'Service-only shared request counter for the Doodhwala Pay Edge Function. One row per auth user; deleted automatically with the auth user.';
comment on function public.doodhwala_payment_api_allow_request(uuid) is
  'Atomic per-user 30 requests per 60 seconds limiter. Execute only with the server service_role; no client role may call it.';
