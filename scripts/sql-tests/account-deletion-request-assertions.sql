\set ON_ERROR_STOP on

insert into auth.users(id) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

-- The normal browser role must have no direct request-table privileges.
do $assertions$
begin
  if has_table_privilege('authenticated', 'private.account_deletion_requests', 'SELECT')
     or has_table_privilege('authenticated', 'private.account_deletion_requests', 'INSERT')
     or has_table_privilege('anon', 'private.account_deletion_requests', 'SELECT') then
    raise exception 'browser_role_has_direct_deletion_queue_access';
  end if;
end;
$assertions$;

-- RPC execution grants are explicit: anonymous callers must not inherit execute.
do $assertions$
begin
  if has_function_privilege('anon', 'public.request_account_deletion(text,text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.get_my_account_deletion_request()', 'EXECUTE')
     or has_function_privilege('anon', 'public.cancel_account_deletion_request(uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.admin_list_account_deletion_requests(integer)', 'EXECUTE')
     or has_function_privilege('anon', 'public.admin_update_account_deletion_request(uuid,text,text)', 'EXECUTE') then
    raise exception 'anonymous_role_has_deletion_rpc_execute';
  end if;
  if not has_function_privilege('authenticated', 'public.request_account_deletion(text,text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.get_my_account_deletion_request()', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.cancel_account_deletion_request(uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.admin_list_account_deletion_requests(integer)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.admin_update_account_deletion_request(uuid,text,text)', 'EXECUTE') then
    raise exception 'authenticated_role_missing_explicit_deletion_rpc_execute';
  end if;
end;
$assertions$;

select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', false);
select set_config('request.jwt.claim.admin', 'false', false);

do $assertions$
declare
  v_first jsonb;
  v_retry jsonb;
  v_status jsonb;
  v_cancel jsonb;
  v_second_after_cancel jsonb;
  v_count integer;
  v_bad_confirmation_rejected boolean := false;
  v_cross_user_cancel_rejected boolean := false;
  v_non_admin_rejected boolean := false;
  v_null_admin_rejected boolean := false;
  v_triage jsonb;
  v_non_admin_triage_rejected boolean := false;
  v_complete_status_rejected boolean := false;
begin
  begin
    perform public.request_account_deletion('delete me', null);
  exception when others then
    if sqlerrm = 'explicit_deletion_confirmation_required' then
      v_bad_confirmation_rejected := true;
    else
      raise;
    end if;
  end;
  if not v_bad_confirmation_rejected then
    raise exception 'invalid_confirmation_was_not_rejected';
  end if;

  v_first := public.request_account_deletion('DELETE MY ACCOUNT', 'synthetic test request');
  v_retry := public.request_account_deletion('DELETE MY ACCOUNT', 'duplicate click');
  if v_first->>'id' is distinct from v_retry->>'id' then
    raise exception 'duplicate_request_did_not_return_existing_id';
  end if;
  if coalesce((v_retry->>'already_pending')::boolean, false) is not true then
    raise exception 'duplicate_request_not_marked_as_existing';
  end if;
  if coalesce((v_first->>'account_deleted')::boolean, true) is not false then
    raise exception 'request_intake_falsely_reported_deletion';
  end if;

  select count(*) into v_count
    from private.account_deletion_requests
   where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
     and status in ('pending', 'under_review', 'blocked_open_orders');
  if v_count <> 1 then
    raise exception 'expected_one_active_request_but_found_%', v_count;
  end if;

  v_status := public.get_my_account_deletion_request();
  if v_status #>> '{request,id}' is distinct from v_first->>'id' then
    raise exception 'request_status_not_scoped_to_current_user';
  end if;

  -- A different account cannot cancel a request it does not own.
  perform set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', false);
  begin
    perform public.cancel_account_deletion_request((v_first->>'id')::uuid);
  exception when others then
    if sqlerrm = 'pending_deletion_request_not_found' then
      v_cross_user_cancel_rejected := true;
    else
      raise;
    end if;
  end;
  if not v_cross_user_cancel_rejected then
    raise exception 'cross_user_cancellation_was_not_rejected';
  end if;

  v_status := public.get_my_account_deletion_request();
  if v_status->'request' <> 'null'::jsonb then
    raise exception 'one_user_can_read_another_users_deletion_status';
  end if;

  -- Non-admin and unknown/NULL admin state must both be denied queue access.
  begin
    perform public.admin_list_account_deletion_requests(50);
  exception when others then
    if sqlerrm = 'admin_access_required' then
      v_non_admin_rejected := true;
    else
      raise;
    end if;
  end;
  if not v_non_admin_rejected then
    raise exception 'non_admin_queue_read_was_not_rejected';
  end if;

  perform set_config('request.jwt.claim.admin', 'null', false);
  begin
    perform public.admin_list_account_deletion_requests(50);
  exception when others then
    if sqlerrm = 'admin_access_required' then
      v_null_admin_rejected := true;
    else
      raise;
    end if;
  end;
  if not v_null_admin_rejected then
    raise exception 'null_admin_queue_read_was_not_rejected';
  end if;

  -- Return to the owning user; cancellation is permitted only while pending.
  perform set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', false);
  perform set_config('request.jwt.claim.admin', 'false', false);
  v_cancel := public.cancel_account_deletion_request((v_first->>'id')::uuid);
  if v_cancel->>'status' <> 'cancelled' then
    raise exception 'pending_request_could_not_be_cancelled';
  end if;

  v_second_after_cancel := public.request_account_deletion('DELETE MY ACCOUNT', 'new request after cancellation');
  if v_second_after_cancel->>'id' = v_first->>'id' then
    raise exception 'new_request_after_cancel_reused_cancelled_request';
  end if;

  perform set_config('request.jwt.claim.admin', 'true', false);
  v_status := public.admin_list_account_deletion_requests(50);
  if jsonb_array_length(v_status) <> 1 then
    raise exception 'admin_queue_should_show_one_active_request';
  end if;

  -- Owner can triage active requests and add a bounded review note.
  v_triage := public.admin_update_account_deletion_request(
    (v_second_after_cancel->>'id')::uuid,
    'under_review',
    'Synthetic QA review note'
  );
  if v_triage->>'status' <> 'under_review'
     or v_triage->>'review_notes' <> 'Synthetic QA review note'
     or coalesce((v_triage->>'account_deleted')::boolean, true) is not false then
    raise exception 'admin_triage_did_not_update_status_safely';
  end if;

  -- Triage RPC must not be usable by a non-admin.
  perform set_config('request.jwt.claim.admin', 'false', false);
  begin
    perform public.admin_update_account_deletion_request(
      (v_second_after_cancel->>'id')::uuid,
      'blocked_open_orders',
      'should not be saved'
    );
  exception when others then
    if sqlerrm = 'admin_access_required' then
      v_non_admin_triage_rejected := true;
    else
      raise;
    end if;
  end;
  if not v_non_admin_triage_rejected then
    raise exception 'non_admin_triage_was_not_rejected';
  end if;

  perform set_config('request.jwt.claim.admin', 'true', false);
  begin
    perform public.admin_update_account_deletion_request(
      (v_second_after_cancel->>'id')::uuid,
      'completed',
      'should not be saved'
    );
  exception when others then
    if sqlerrm = 'unsupported_deletion_review_status' then
      v_complete_status_rejected := true;
    else
      raise;
    end if;
  end;
  if not v_complete_status_rejected then
    raise exception 'admin_triage_allowed_false_completion';
  end if;
end;
$assertions$;

select 'account deletion request intake checks passed' as result;
