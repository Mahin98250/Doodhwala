-- Execute after applying the migration to the isolated fixture.
do $$
declare
  row_count integer;
  product_count integer;
  serviceable boolean;
begin
  select count(*)
    into row_count
  from public.find_nearby_providers_v2(23.0225, 72.5714, 20) result
  where result.provider_id = '00000000-0000-0000-0000-000000000001'::uuid;

  if row_count <> 1 then
    raise exception 'nearby approved provider was not returned exactly once';
  end if;

  select jsonb_array_length(result.products), result.is_serviceable
    into product_count, serviceable
  from public.find_nearby_providers_v2(23.0225, 72.5714, 20) result
  where result.provider_id = '00000000-0000-0000-0000-000000000001'::uuid;

  if product_count <> 2 then
    raise exception 'expected only active/in-stock products, got %', product_count;
  end if;
  if serviceable is distinct from true then
    raise exception 'nearby provider should remain serviceable';
  end if;

  select count(*)
    into row_count
  from public.find_nearby_providers_v2(23.0225, 72.5714, 20) result
  where result.provider_id = '00000000-0000-0000-0000-000000000002'::uuid;
  if row_count <> 0 then
    raise exception 'far-away provider must be excluded from the bounded radius';
  end if;

  -- Longitude crosses +180/-180 here; the bounding box must not drop this nearby provider.
  select count(*)
    into row_count
  from public.find_nearby_providers_v2(10.0, 179.98, 10) result
  where result.provider_id = '00000000-0000-0000-0000-000000000003'::uuid;
  if row_count <> 1 then
    raise exception 'longitude wraparound dropped a nearby provider';
  end if;

  -- Missing coordinates preserve the existing browse-all behavior while keeping
  -- unapproved/inactive providers out of discovery.
  select count(*)
    into row_count
  from public.find_nearby_providers_v2(null, null, 20);
  if row_count <> 3 then
    raise exception 'coordinate-free discovery should return the 3 active approved fixture providers, got %', row_count;
  end if;
end;
$$;

do $
declare
  open_index text;
  daily_index text;
begin
  select indexdef into open_index
  from pg_indexes
  where schemaname = 'public'
    and indexname = 'orders_provider_open_capacity_idx';
  if open_index is null then
    raise exception 'open-order capacity index was not created';
  end if;
  if position('provider_id' in open_index) = 0
     or position('placed' in open_index) = 0 then
    raise exception 'open-order capacity index does not match the capacity query predicate: %', open_index;
  end if;

  select indexdef into daily_index
  from pg_indexes
  where schemaname = 'public'
    and indexname = 'orders_provider_daily_litres_idx';
  if daily_index is null then
    raise exception 'daily litre-capacity index was not created';
  end if;
  if position('provider_id' in daily_index) = 0
     or position('Asia/Kolkata' in daily_index) = 0
     or position('rejected' in daily_index) = 0
     or position('cancelled' in daily_index) = 0 then
    raise exception 'daily litre-capacity index does not match the production query predicate: %', daily_index;
  end if;
end;
$;

select 'PASS: bounded nearby-search and order-capacity PostgreSQL integration checks' as result;
