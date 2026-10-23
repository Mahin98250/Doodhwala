-- Doodhwala marketplace scalability: bound provider candidates before distance math
-- and fetch products only for surviving nearby providers.
--
-- The public result shape and authorization model are unchanged. This is a read-only
-- query-plan improvement; it does not mutate live data or apply itself to production.
create or replace function public.find_nearby_providers_v2(
  p_latitude numeric default null,
  p_longitude numeric default null,
  p_max_km numeric default 20
)
returns table(
  provider_id uuid,
  provider_name text,
  area_name text,
  city text,
  pin_code text,
  milk_type text,
  rating_avg numeric,
  delivery_from time,
  delivery_to time,
  latitude numeric,
  longitude numeric,
  distance_km numeric,
  service_radius_km numeric,
  is_serviceable boolean,
  products jsonb
)
language sql
security invoker
set search_path = public, pg_temp
as $$
  with search_params as (
    select
      p_latitude as center_latitude,
      p_longitude as center_longitude,
      least(coalesce(p_max_km, 20), 25) as max_km,
      case
        when p_latitude is null or p_longitude is null then null
        else least(
          180::numeric,
          (
            abs(least(coalesce(p_max_km, 20), 25))
            / (
              110.0
              * greatest(abs(cos(radians(p_latitude))), 0.000001)
            )
          )::numeric
        )
      end as longitude_delta
  ),
  bounded_providers as (
    select
      pp.id,
      pp.display_name,
      pp.area_name,
      pp.city,
      pp.pin_code,
      pp.primary_milk_type,
      pp.rating_avg,
      pp.delivery_from,
      pp.delivery_to,
      coalesce(pp.service_radius_km, 5) as service_radius_km,
      psa.latitude,
      psa.longitude
    from public.provider_profiles pp
    join public.provider_service_areas psa on psa.provider_id = pp.id
    cross join search_params s
    where pp.is_active
      and exists (
        select 1
        from public.provider_verifications pv
        where pv.provider_id = pp.id
          and pv.status = 'approved'
      )
      and (
        s.center_latitude is null
        or s.center_longitude is null
        or (
          psa.latitude between
            greatest(-90::numeric, s.center_latitude - abs(s.max_km) / 110.0)
            and least(90::numeric, s.center_latitude + abs(s.max_km) / 110.0)
          and (
            s.longitude_delta >= 180
            or (
              s.center_longitude - s.longitude_delta >= -180
              and s.center_longitude + s.longitude_delta <= 180
              and psa.longitude between
                s.center_longitude - s.longitude_delta
                and s.center_longitude + s.longitude_delta
            )
            or (
              s.center_longitude - s.longitude_delta < -180
              and (
                psa.longitude >= s.center_longitude - s.longitude_delta + 360
                or psa.longitude <= s.center_longitude + s.longitude_delta
              )
            )
            or (
              s.center_longitude + s.longitude_delta > 180
              and (
                psa.longitude >= s.center_longitude - s.longitude_delta
                or psa.longitude <= s.center_longitude + s.longitude_delta - 360
              )
            )
          )
        )
      )
  ),
  scored_providers as (
    select
      b.*,
      case
        when s.center_latitude is null or s.center_longitude is null then null
        else 6371.0 * 2 * asin(
          sqrt(
            power(sin(radians(b.latitude - s.center_latitude) / 2), 2)
            + cos(radians(s.center_latitude)) * cos(radians(b.latitude))
              * power(sin(radians(b.longitude - s.center_longitude) / 2), 2)
          )
        )
      end as distance_km
    from bounded_providers b
    cross join search_params s
  ),
  nearby_providers as (
    select scored.*
    from scored_providers scored
    cross join search_params s
    where scored.distance_km is null
       or scored.distance_km <= s.max_km
  )
  select
    b.id,
    b.display_name,
    b.area_name,
    b.city,
    b.pin_code,
    b.primary_milk_type,
    b.rating_avg,
    b.delivery_from,
    b.delivery_to,
    b.latitude,
    b.longitude,
    round(b.distance_km::numeric, 2),
    b.service_radius_km,
    case
      when p_latitude is null or p_longitude is null then null
      else b.distance_km <= b.service_radius_km
    end,
    coalesce(product_rows.products, '[]'::jsonb)
  from nearby_providers b
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'id', mp.id,
        'name', mp.name,
        'milk_type', mp.milk_type,
        'price_per_litre', mp.price_per_litre,
        'unit_label', mp.unit_label,
        'stock', mp.stock,
        'daily_available', mp.daily_available,
        'is_active', mp.is_active
      )
      order by mp.created_at
    ) as products
    from public.milk_products mp
    where mp.provider_id = b.id
      and mp.is_active
      and mp.stock
  ) product_rows on true
  order by b.distance_km nulls last, b.rating_avg desc nulls last, b.display_name;
$$;

revoke execute on function public.find_nearby_providers_v2(numeric, numeric, numeric) from public;
grant execute on function public.find_nearby_providers_v2(numeric, numeric, numeric) to anon, authenticated;
