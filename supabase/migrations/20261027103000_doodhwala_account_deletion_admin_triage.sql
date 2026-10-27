-- Owner triage controls for account deletion request intake.
-- This does not provide a "complete deletion" action. Final deletion/anonymisation
-- remains a separate, audited workflow and cannot be marked complete through this RPC.

alter table private.account_deletion_requests
  add column if not exists review_notes text;

alter table private.account_deletion_requests
  add constraint account_deletion_requests_review_notes_length_check
  check (review_notes is null or length(review_notes) <= 1000);

create or replace function public.admin_update_account_deletion_request(
  p_request_id uuid,
  p_status text,
  p_review_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_request private.account_deletion_requests%rowtype;
  v_notes text := nullif(left(trim(coalesce(p_review_notes, '')), 1000), '');
begin
  if auth.uid() is null or not coalesce(private.is_current_user_admin(), false) then
    raise exception 'admin_access_required' using errcode = '42501';
  end if;

  if p_request_id is null then
    raise exception 'request_id_required' using errcode = '22023';
  end if;

  -- Deliberately disallow "completed" and "cancelled" here:
  -- only the user may cancel a pending request, and completion requires a
  -- separately reviewed deletion/anonymisation finalizer.
  if p_status not in ('under_review', 'blocked_open_orders') then
    raise exception 'unsupported_deletion_review_status' using errcode = '22023';
  end if;

  update private.account_deletion_requests r
     set status = p_status,
         review_notes = v_notes,
         updated_at = now()
   where r.id = p_request_id
     and r.status in ('pending', 'under_review', 'blocked_open_orders')
  returning * into v_request;

  if not found then
    raise exception 'active_deletion_request_not_found' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'id', v_request.id,
    'status', v_request.status,
    'review_notes', v_request.review_notes,
    'requested_at', v_request.requested_at,
    'updated_at', v_request.updated_at,
    'account_deleted', false
  );
end
$function$;

revoke all on function public.admin_update_account_deletion_request(uuid, text, text) from public, anon;
grant execute on function public.admin_update_account_deletion_request(uuid, text, text) to authenticated;
