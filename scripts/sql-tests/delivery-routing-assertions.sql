do $$
declare
  v_rls_count integer;
begin
  select count(*) into v_rls_count
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public'
    and c.relname in ('delivery_route_runs','delivery_route_stops','delivery_live_locations')
    and c.relrowsecurity;
  if v_rls_count <> 3 then raise exception 'delivery_tables_missing_rls'; end if;

  if has_table_privilege('authenticated','public.delivery_route_runs','INSERT')
     or has_table_privilege('authenticated','public.delivery_route_runs','UPDATE')
     or has_table_privilege('authenticated','public.delivery_route_stops','INSERT')
     or has_table_privilege('authenticated','public.delivery_route_stops','UPDATE')
     or has_table_privilege('authenticated','public.delivery_live_locations','INSERT')
     or has_table_privilege('authenticated','public.delivery_live_locations','UPDATE')
     or has_table_privilege('authenticated','public.delivery_provider_drivers','INSERT')
     or has_table_privilege('authenticated','public.delivery_driver_enrollments','UPDATE')
  then raise exception 'authenticated_role_has_direct_delivery_write'; end if;

  if has_function_privilege('anon','public.delivery_create_route(uuid,uuid,date,timestamptz,uuid[],timestamptz[],timestamptz[],integer,integer,jsonb,integer)','EXECUTE') then
    raise exception 'anon_can_create_delivery_route';
  end if;
  if not exists(select 1 from pg_indexes where schemaname='public' and indexname='delivery_route_stops_route_status_sequence_idx') then
    raise exception 'route_stop_index_missing';
  end if;
  if not exists(select 1 from pg_indexes where schemaname='public' and indexname='delivery_route_runs_active_driver_idx') then
    raise exception 'driver_queue_index_missing';
  end if;
  if not exists(select 1 from pg_policies where schemaname='realtime' and tablename='messages' and policyname='Delivery participants can receive private route broadcasts') then
    raise exception 'private_route_broadcast_policy_missing';
  end if;
end $$;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',false);
select public.delivery_driver_enroll();
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
select public.delivery_provider_link_driver(
  '10000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000003'
);

do $$
declare v_drivers jsonb; v_planning jsonb;
begin
  v_drivers:=public.delivery_list_enrolled_drivers('10000000-0000-4000-8000-000000000001');
  if jsonb_array_length(v_drivers)<>1 or v_drivers->0->>'linked'<>'true' then raise exception 'driver_enrollment_linking_failed'; end if;
  v_planning:=public.delivery_get_route_planning_data('10000000-0000-4000-8000-000000000001',49);
  if jsonb_array_length(v_planning->'orders')<>2 then raise exception 'eligible_delivery_queue_missing_stops'; end if;
  if v_planning->'origin'->>'latitude'<>'23.0200' then raise exception 'route_origin_missing'; end if;
end $$;

create temporary table delivery_test_context(route_id uuid);
insert into delivery_test_context(route_id)
select public.delivery_create_route(
  '10000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000003',
  (now() at time zone 'Asia/Kolkata')::date,
  now()+interval '15 minutes',
  array[
    '20000000-0000-4000-8000-000000000001'::uuid,
    '20000000-0000-4000-8000-000000000002'::uuid
  ],
  array[now()+interval '25 minutes',now()+interval '35 minutes']::timestamptz[],
  array[now()+interval '35 minutes',now()+interval '45 minutes']::timestamptz[],
  2500,600,
  jsonb_build_object('type','LineString','coordinates',jsonb_build_array(
    jsonb_build_array(72.4900,23.0200),
    jsonb_build_array(72.5000,23.0300),
    jsonb_build_array(72.5050,23.0350)
  )),
  60
);

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',false);
select public.delivery_start_route((select route_id from delivery_test_context));
select public.delivery_update_location(
  (select route_id from delivery_test_context),
  23.0250,72.4950,8,90,4
);

do $$
declare v_route jsonb;
begin
  v_route:=public.delivery_get_my_active_route();
  if v_route->'route'->>'status'<>'active' then raise exception 'driver_active_route_missing'; end if;
  if jsonb_array_length(v_route->'route'->'stops')<>2 then raise exception 'driver_stop_list_missing'; end if;
  if not exists(
    select 1 from realtime.messages
    where topic='delivery-route:'||(select route_id::text from delivery_test_context)
      and extension='broadcast'
      and payload->'payload'->>'latitude'='23.025'
  ) then raise exception 'location_broadcast_not_emitted'; end if;
  begin
    perform public.delivery_mark_route_stop_action(
      (select id from public.delivery_route_stops where route_id=(select route_id from delivery_test_context) and sequence_no=2),
      'arrived',null
    );
    raise exception 'out_of_order_stop_was_allowed';
  exception when others then
    if sqlerrm<>'previous_route_stop_not_completed' then raise; end if;
  end;
end $$;

select public.delivery_mark_route_stop_action(
 (select id from public.delivery_route_stops where route_id=(select route_id from delivery_test_context) and sequence_no=1),
 'arrived',null
);
select public.delivery_mark_route_stop_action(
 (select id from public.delivery_route_stops where route_id=(select route_id from delivery_test_context) and sequence_no=1),
 'delivered',null
);
select public.delivery_mark_route_stop_action(
 (select id from public.delivery_route_stops where route_id=(select route_id from delivery_test_context) and sequence_no=2),
 'arrived',null
);
select public.delivery_mark_route_stop_action(
 (select id from public.delivery_route_stops where route_id=(select route_id from delivery_test_context) and sequence_no=2),
 'delivered',null
);

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
do $$
declare v_tracking jsonb;
begin
  v_tracking:=public.delivery_get_my_tracking('20000000-0000-4000-8000-000000000001');
  if v_tracking->>'available'<>'true' then raise exception 'customer_tracking_unavailable'; end if;
  if v_tracking->>'route_status'<>'completed' then raise exception 'route_completion_not_exposed'; end if;
  if v_tracking->>'stop_number'<>'1' then raise exception 'customer_stop_number_incorrect'; end if;
  if v_tracking ? 'recipient_phone' then raise exception 'tracking_payload_leaks_phone'; end if;
  if position('2 Test Street' in v_tracking::text)>0 then raise exception 'tracking_payload_leaks_other_customer_address'; end if;
  if (v_tracking->'location') <> 'null'::jsonb then raise exception 'completed_route_still_exposes_live_location'; end if;
  begin
    perform public.delivery_get_my_tracking('20000000-0000-4000-8000-000000000002');
    raise exception 'cross_account_tracking_was_allowed';
  exception when others then
    if sqlerrm<>'order_not_owned_or_missing' then raise; end if;
  end;
end $$;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000004',false);
do $$
begin
  begin
    perform public.delivery_get_my_tracking('20000000-0000-4000-8000-000000000001');
    raise exception 'other_customer_tracking_was_allowed';
  exception when others then
    if sqlerrm<>'order_not_owned_or_missing' then raise; end if;
  end;
end $$;

select 'PASS: consent, provider/driver assignment, planning, route lifecycle, private GPS broadcast, stop order and customer isolation' as result;
