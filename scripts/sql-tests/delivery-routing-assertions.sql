do $$
declare
  v_rls_count integer;
begin
  select count(*) into v_rls_count
  from pg_class c
  join pg_namespace n on n.oid=c.relnamespace
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
  then raise exception 'authenticated_role_has_direct_delivery_write'; end if;

  if not exists(select 1 from pg_indexes where schemaname='public' and indexname='delivery_route_stops_route_status_sequence_idx') then
    raise exception 'route_stop_index_missing';
  end if;
  if not exists(select 1 from pg_indexes where schemaname='public' and indexname='delivery_route_runs_driver_date_idx') then
    raise exception 'driver_queue_index_missing';
  end if;
  if (select count(*) from pg_policies where schemaname='public' and tablename in ('delivery_route_runs','delivery_route_stops','delivery_live_locations')) < 3 then
    raise exception 'delivery_rls_policies_missing';
  end if;
end $$;
select 'PASS: route schema, RLS, indexes and no direct authenticated writes' as result;
