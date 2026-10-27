-- Account-deletion request intake and status tracking.
-- This migration does not delete accounts or erase retained order/financial records.
-- Final deletion/anonymization must be implemented and reviewed separately before store release.

create schema if not exists private;

create table if not exists private.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'under_review', 'blocked_open_orders', 'cancelled', 'completed')),
  reason text,
  requested_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  check ((status = 'completed') = (completed_at is not null)),
  check (reason is null or length(reason) <= 500)
);

alter table private.account_deletion_requests enable row level security;
revoke all on private.account_deletion_requests from public, anon, authenticated;

create index if not exists account_deletion_requests_status_date_idx
  on private.account_deletion_requests(status, requested_at desc);

create unique index if not exists account_deletion_requests_one_active_per_user_idx
  on private.account_deletion_requests(user_id)
  where user_id is not null
    and status in ('pending', 'under_review', 'blocked_open_orders');

create or replace function public.request_account_deletion(
  p_confirmation text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_request private.account_deletion_requests%rowtype;
  v_reason text := nullif(left(trim(coalesce(p_reason, '')), 500), '');
begin
  if v_uid is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if p_confirmation is distinct from 'DELETE MY ACCOUNT' then
    raise exception 'explicit_deletion_confirmation_required' using errcode = '22023';
  end if;

  select *
    into v_request
    from private.account_deletion_requests r
   where r.user_id = v_uid
     and r.status in ('pending', 'under_review', 'blocked_open_orders')
   order by r.requested_at desc
   limit 1;

  if found then
    return jsonb_build_object(
      'id', v_request.id,
      'status', v_request.status,
      'requested_at', v_request.requested_at,
      'updated_at', v_request.updated_at,
      'already_pending', true,
      'account_deleted', false
    );
  end if;

  begin
    insert into private.account_deletion_requests(user_id, reason)
    values (v_uid, v_reason)
    returning * into v_request;
  exception when unique_violation then
    -- Concurrent duplicate clicks are safe: return the one active request.
    select *
      into v_request
      from private.account_deletion_requests r
     where r.user_id = v_uid
       and r.status in ('pending', 'under_review', 'blocked_open_orders')
     order by r.requested_at desc
     limit 1;
  end;

  if v_request.id is null then
    raise exception 'deletion_request_retry_required' using errcode = '40001';
  end if;

  return jsonb_build_object(
    'id', v_request.id,
    'status', v_request.status,
    'requested_at', v_request.requested_at,
    'updated_at', v_request.updated_at,
    'already_pending', false,
    'account_deleted', false
  );
end
$function$;

create or replace function public.get_my_account_deletion_request()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_request private.account_deletion_requests%rowtype;
begin
  if v_uid is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  select *
    into v_request
    from private.account_deletion_requests r
   where r.user_id = v_uid
   order by r.requested_at desc
   limit 1;

  if not found then
    return jsonb_build_object('request', null, 'account_deleted', false);
  end if;

  return jsonb_build_object(
    'request', jsonb_build_object(
      'id', v_request.id,
      'status', v_request.status,
      'requested_at', v_request.requested_at,
      'updated_at', v_request.updated_at,
      'completed_at', v_request.completed_at
    ),
    'account_deleted', v_request.status = 'completed'
  );
end
$function$;

create or replace function public.cancel_account_deletion_request(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_request private.account_deletion_requests%rowtype;
begin
  if v_uid is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if p_request_id is null then
    raise exception 'request_id_required' using errcode = '22023';
  end if;

  update private.account_deletion_requests r
     set status = 'cancelled',
         updated_at = now()
   where r.id = p_request_id
     and r.user_id = v_uid
     and r.status = 'pending'
  returning * into v_request;

  if not found then
    raise exception 'pending_deletion_request_not_found' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'id', v_request.id,
    'status', v_request.status,
    'updated_at', v_request.updated_at,
    'account_deleted', false
  );
end
$function$;

create or replace function public.admin_list_account_deletion_requests(p_limit integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_result jsonb;
begin
  if auth.uid() is null or not coalesce(private.is_current_user_admin(), false) then
    raise exception 'admin_access_required' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(to_jsonb(q) order by q.requested_at asc), '[]'::jsonb)
    into v_result
    from (
      select id, user_id, status, reason, requested_at, updated_at, completed_at
        from private.account_deletion_requests
       where status in ('pending', 'under_review', 'blocked_open_orders')
       order by requested_at asc
       limit greatest(1, least(coalesce(p_limit, 50), 200))
    ) q;

  return v_result;
end
$function$;

revoke all on function public.request_account_deletion(text, text) from public, anon;
grant execute on function public.request_account_deletion(text, text) to authenticated;

revoke all on function public.get_my_account_deletion_request() from public, anon;
grant execute on function public.get_my_account_deletion_request() to authenticated;

revoke all on function public.cancel_account_deletion_request(uuid) from public, anon;
grant execute on function public.cancel_account_deletion_request(uuid) to authenticated;

revoke all on function public.admin_list_account_deletion_requests(integer) from public, anon;
grant execute on function public.admin_list_account_deletion_requests(integer) to authenticated;

comment on table private.account_deletion_requests is
  'Private account deletion request intake. A pending request is not proof that account data has been deleted.';
