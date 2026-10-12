-- Keep the owner control-center indexes synchronized with customer and provider changes.
-- Only allow the private owner allowlist to receive row-change events for these tables.
do $$
declare
  t text;
  tables text[] := array['profiles','milk_products','provider_service_areas'];
begin
  foreach t in array tables loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname='supabase_realtime'
        and schemaname='public'
        and tablename=t
    ) then
      execute format('alter publication supabase_realtime add table public.%I',t);
    end if;

    if not exists (
      select 1
      from pg_policies
      where schemaname='public'
        and tablename=t
        and policyname='admin_realtime_select'
    ) then
      execute format(
        'create policy admin_realtime_select on public.%I for select to authenticated using ((select private.is_current_user_admin()))',
        t
      );
    end if;
  end loop;
end $$;
