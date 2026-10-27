\set ON_ERROR_STOP on

insert into auth.users(id) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc');

insert into public.orders(id, customer_id, provider_owner_id)
values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

-- Inserting status events should create customer updates and a provider new-order alert.
insert into public.order_status_events(id, order_id, from_status, to_status)
values
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', null, 'placed'),
 ('ffffffff-ffff-4fff-8fff-ffffffffffff', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'placed', 'accepted'),
 ('11111111-1111-4111-8111-111111111111', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'accepted', 'delivered');

do $$
declare
  v_result jsonb;
  v_notification_id uuid;
  v_cross_user_rejected boolean := false;
  v_unread integer;
  v_marked jsonb;
  v_page_one jsonb;
  v_page_two jsonb;
  v_distinct_page_ids integer;
begin
  if (select count(*) from public.user_notifications
       where user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') <> 3 then
    raise exception 'customer_did_not_receive_each_order_status_event';
  end if;
  if (select count(*) from public.user_notifications
       where user_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') <> 1 then
    raise exception 'provider_should_only_receive_new_order_alert';
  end if;
  if (select count(*) from public.user_notifications
       where user_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc') <> 0 then
    raise exception 'unrelated_user_received_order_notification';
  end if;

  if has_table_privilege('authenticated','public.user_notifications','SELECT')
     or has_table_privilege('authenticated','public.user_notifications','UPDATE')
     or has_table_privilege('anon','public.user_notifications','SELECT') then
    raise exception 'browser_role_has_direct_notification_table_access';
  end if;

  if has_function_privilege('anon','public.get_my_notifications(integer,timestamptz,uuid)','EXECUTE')
     or has_function_privilege('anon','public.mark_my_notification_read(uuid)','EXECUTE')
     or has_function_privilege('anon','public.mark_all_my_notifications_read()','EXECUTE') then
    raise exception 'anonymous_role_has_notification_rpc_execute';
  end if;
  if not has_function_privilege('authenticated','public.get_my_notifications(integer,timestamptz,uuid)','EXECUTE')
     or not has_function_privilege('authenticated','public.mark_my_notification_read(uuid)','EXECUTE')
     or not has_function_privilege('authenticated','public.mark_all_my_notifications_read()','EXECUTE') then
    raise exception 'authenticated_role_missing_notification_rpc_execute';
  end if;

  perform set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
  v_result := public.get_my_notifications(20,null);
  if jsonb_array_length(v_result->'items') <> 3
     or (v_result->>'unread_count')::integer <> 3 then
    raise exception 'customer_notification_list_or_unread_count_incorrect';
  end if;

  v_notification_id := (v_result->'items'->0->>'id')::uuid;
  v_marked := public.mark_my_notification_read(v_notification_id);
  if v_marked->>'id' is distinct from v_notification_id::text
     or v_marked->>'read_at' is null then
    raise exception 'notification_read_action_failed';
  end if;

  -- Other users cannot mark a notification as read by guessing its UUID.
  perform set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-cccccccccccc',false);
  begin
    perform public.mark_my_notification_read(v_notification_id);
  exception when others then
    if sqlerrm='notification_not_found' then
      v_cross_user_rejected := true;
    else
      raise;
    end if;
  end;
  if not v_cross_user_rejected then
    raise exception 'cross_user_notification_mark_read_was_not_rejected';
  end if;

  perform set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
  v_marked := public.mark_all_my_notifications_read();
  if (v_marked->>'updated_count')::integer <> 2 then
    raise exception 'mark_all_read_count_incorrect';
  end if;

  v_result := public.get_my_notifications(20,null);
  if (v_result->>'unread_count')::integer <> 0 then
    raise exception 'unread_count_not_zero_after_mark_all_read';
  end if;

  -- Pagination is bounded by the requested limit.
  v_result := public.get_my_notifications(1,null,null);
  if jsonb_array_length(v_result->'items') <> 1 then
    raise exception 'notification_page_limit_not_respected';
  end if;

  -- All three fixture notifications share a transaction timestamp. A timestamp-only
  -- cursor would skip rows tied with the page boundary; the UUID tie-breaker must not.
  v_page_one := public.get_my_notifications(2,null,null);
  if jsonb_array_length(v_page_one->'items') <> 2 then
    raise exception 'first_notification_cursor_page_size_incorrect';
  end if;
  v_page_two := public.get_my_notifications(
    2,
    (v_page_one->'items'->1->>'created_at')::timestamptz,
    (v_page_one->'items'->1->>'id')::uuid
  );
  if jsonb_array_length(v_page_two->'items') <> 1 then
    raise exception 'equal_timestamp_notification_was_skipped';
  end if;
  select count(distinct notification_id) into v_distinct_page_ids
    from (
      select value->>'id' as notification_id from jsonb_array_elements(v_page_one->'items')
      union all
      select value->>'id' as notification_id from jsonb_array_elements(v_page_two->'items')
    ) as pages;
  if v_distinct_page_ids <> 3 then
    raise exception 'notification_cursor_pages_did_not_return_each_row_once';
  end if;
end
$$;

select 'in-app order notification checks passed' as result;
