-- Consolidate overlapping admin realtime SELECT policies.
-- Preserve the exact anon/public and owner/admin visibility boundaries while ensuring
-- each of these tables has no duplicate permissive SELECT policy for authenticated users.

-- Profiles: the owner and allowlisted admin see profiles through one policy.
drop policy if exists admin_realtime_select on public.profiles;
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
on public.profiles
for select
to authenticated
using (
  (select auth.uid()) = id
  or (select private.is_current_user_admin())
);

-- Products: keep the public catalogue expression separate so anon never needs
-- EXECUTE on the private admin-only authorization helper.
drop policy if exists admin_realtime_select on public.milk_products;
drop policy if exists milk_products_select_public_or_owner on public.milk_products;
create policy milk_products_select_anon
on public.milk_products
for select
to anon
using (
  exists (
    select 1
    from public.provider_profiles pp
    where pp.id = milk_products.provider_id
      and (
        pp.owner_user_id = (select auth.uid())
        or (
          pp.is_active
          and milk_products.is_active
          and milk_products.stock
          and private.is_approved_provider(pp.id)
        )
      )
  )
);
create policy milk_products_select_authenticated
on public.milk_products
for select
to authenticated
using (
  exists (
    select 1
    from public.provider_profiles pp
    where pp.id = milk_products.provider_id
      and (
        pp.owner_user_id = (select auth.uid())
        or (
          pp.is_active
          and milk_products.is_active
          and milk_products.stock
          and private.is_approved_provider(pp.id)
        )
      )
  )
  or (select private.is_current_user_admin())
);

-- Service areas: same boundary as before, with admin access folded into the
-- authenticated policy. The anonymous policy contains no admin-helper call.
drop policy if exists admin_realtime_select on public.provider_service_areas;
drop policy if exists service_area_select_public_or_owner on public.provider_service_areas;
create policy service_area_select_anon
on public.provider_service_areas
for select
to anon
using (
  exists (
    select 1
    from public.provider_profiles pp
    where pp.id = provider_service_areas.provider_id
      and (
        pp.owner_user_id = (select auth.uid())
        or private.is_approved_provider(pp.id)
      )
  )
);
create policy service_area_select_authenticated
on public.provider_service_areas
for select
to authenticated
using (
  exists (
    select 1
    from public.provider_profiles pp
    where pp.id = provider_service_areas.provider_id
      and (
        pp.owner_user_id = (select auth.uid())
        or private.is_approved_provider(pp.id)
      )
  )
  or (select private.is_current_user_admin())
);
