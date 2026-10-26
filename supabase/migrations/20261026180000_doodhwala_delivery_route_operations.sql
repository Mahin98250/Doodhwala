-- Smart delivery operations: driver consent, provider assignment, route lifecycle and private tracking.
-- Additive only; this migration is not applied to production by this workflow.

create schema if not exists private;

alter table public.delivery_route_runs
  add column if not exists planned_start_at timestamptz,
  add column if not exists origin_latitude double precision,
  add column if not exists origin_longitude double precision,
  add column if not exists route_geometry jsonb,
  add column if not exists stop_service_seconds integer not null default 60
    check (stop_service_seconds between 15 and 300);

alter table public.delivery_route_stops add column if not exists skip_reason text;
alter table public.delivery_route_stops drop constraint if exists delivery_route_stops_skip_reason_check;
alter table public.delivery_route_stops add constraint delivery_route_stops_skip_reason_check
  check (skip_reason is null or length(skip_reason) <= 300);

create table if not exists public.delivery_driver_enrollments (
  driver_user_id uuid primary key references public.profiles(id) on delete cascade,
  is_active boolean not null default true,
  consented_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.delivery_provider_drivers (
  provider_id uuid not null references public.provider_profiles(id) on delete cascade,
  driver_user_id uuid not null references public.profiles(id) on delete cascade,
  is_active boolean not null default true,
  linked_by uuid not null references public.profiles(id) on delete restrict,
  linked_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (provider_id, driver_user_id)
);

create index if not exists delivery_provider_drivers_driver_idx
  on public.delivery_provider_drivers(driver_user_id, is_active);
create index if not exists delivery_route_runs_active_driver_idx
  on public.delivery_route_runs(driver_user_id, status, service_date);

alter table public.delivery_driver_enrollments enable row level security;
alter table public.delivery_provider_drivers enable row level security;
revoke all on public.delivery_driver_enrollments from anon, authenticated;
revoke all on public.delivery_provider_drivers from anon, authenticated;

-- A driver explicitly opts in from the delivery-person experience.
create or replace function public.delivery_driver_enroll()
returns boolean
language plpgsql
security definer
set search_path = ''
as $delivery_fn$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'authentication_required'; end if;
  insert into public.delivery_driver_enrollments(driver_user_id,is_active,consented_at,updated_at)
  values(v_uid,true,now(),now())
  on conflict (driver_user_id) do update
    set is_active=true,consented_at=now(),updated_at=now();
  return true;
end;
$delivery_fn$;

create or replace function public.delivery_driver_is_enrolled()
returns boolean
language sql
security definer
set search_path = ''
as $delivery_fn$
  select exists(
    select 1 from public.delivery_driver_enrollments e
    where e.driver_user_id=auth.uid() and e.is_active
  );
$delivery_fn$;

create or replace function public.delivery_driver_opt_out()
returns boolean
language plpgsql
security definer
set search_path = ''
as $delivery_fn$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'authentication_required'; end if;
  if exists (
    select 1 from public.delivery_route_runs r
    where r.driver_user_id=v_uid and r.status in ('planned','active')
  ) then raise exception 'active_route_must_be_reassigned_first'; end if;
  update public.delivery_driver_enrollments
  set is_active=false,updated_at=now()
  where driver_user_id=v_uid;
  update public.delivery_provider_drivers
  set is_active=false,updated_at=now()
  where driver_user_id=v_uid;
  return true;
end;
$delivery_fn$;

-- Provider owners can only link drivers who explicitly enrolled first.
create or replace function public.delivery_provider_link_driver(
  p_provider_id uuid,
  p_driver_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $delivery_fn$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'authentication_required'; end if;
  if not exists (
    select 1 from public.provider_profiles pp
    where pp.id=p_provider_id and pp.owner_user_id=v_uid
  ) then raise exception 'provider_owner_required'; end if;
  if p_driver_user_id is null or p_driver_user_id=v_uid then
    raise exception 'invalid_delivery_driver';
  end if;
  if not exists (
    select 1 from public.delivery_driver_enrollments e
    where e.driver_user_id=p_driver_user_id and e.is_active
  ) then raise exception 'driver_has_not_enrolled'; end if;
  insert into public.delivery_provider_drivers(provider_id,driver_user_id,is_active,linked_by,linked_at,updated_at)
  values(p_provider_id,p_driver_user_id,true,v_uid,now(),now())
  on conflict(provider_id,driver_user_id) do update
    set is_active=true,linked_by=v_uid,linked_at=now(),updated_at=now();
  return true;
end;
$delivery_fn$;

create or replace function public.delivery_provider_unlink_driver(
  p_provider_id uuid,
  p_driver_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $delivery_fn$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'authentication_required'; end if;
  if not exists (
    select 1 from public.provider_profiles pp
    where pp.id=p_provider_id and pp.owner_user_id=v_uid
  ) then raise exception 'provider_owner_required'; end if;
  if exists (
    select 1 from public.delivery_route_runs r
    where r.provider_id=p_provider_id and r.driver_user_id=p_driver_user_id
      and r.status in ('planned','active')
  ) then raise exception 'driver_has_route_to_reassign'; end if;
  update public.delivery_provider_drivers
  set is_active=false,updated_at=now()
  where provider_id=p_provider_id and driver_user_id=p_driver_user_id;
  return true;
end;
$delivery_fn$;

create or replace function public.delivery_list_enrolled_drivers(p_provider_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $delivery_fn$
declare v_uid uuid := auth.uid(); v_result jsonb;
begin
  if v_uid is null then raise exception 'authentication_required'; end if;
  if not exists (
    select 1 from public.provider_profiles pp
    where pp.id=p_provider_id and pp.owner_user_id=v_uid
  ) then raise exception 'provider_owner_required'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'driver_user_id',e.driver_user_id,
    'display_name',coalesce(nullif(p.full_name,''),'Delivery partner'),
    'linked',coalesce(d.is_active,false)
  ) order by coalesce(nullif(p.full_name,''),'Delivery partner'),e.driver_user_id),'[]'::jsonb)
  into v_result
  from public.delivery_driver_enrollments e
  join public.profiles p on p.id=e.driver_user_id
  left join public.delivery_provider_drivers d
    on d.provider_id=p_provider_id and d.driver_user_id=e.driver_user_id
  where e.is_active;
  return v_result;
end;
$delivery_fn$;

-- This endpoint returns only eligible drops for the authenticated provider owner.
-- Coordinates and address details are limited to signed-in operations users.
create or replace function public.delivery_get_route_planning_data(
  p_provider_id uuid,
  p_limit integer default 99
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $delivery_fn$
declare
  v_uid uuid := auth.uid();
  v_origin record;
  v_orders jsonb;
  v_limit integer := least(greatest(coalesce(p_limit,99),1),99);
begin
  if v_uid is null then raise exception 'authentication_required'; end if;
  if not exists (
    select 1 from public.provider_profiles pp
    where pp.id=p_provider_id and pp.owner_user_id=v_uid
  ) then raise exception 'provider_owner_required'; end if;

  select a.latitude,a.longitude
  into v_origin
  from public.provider_service_areas a
  where a.provider_id=p_provider_id;
  if not found then raise exception 'provider_route_origin_not_configured'; end if;

  select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at,q.order_id),'[]'::jsonb)
  into v_orders
  from (
    select o.id as order_id,
      o.delivery_latitude::double precision as latitude,
      o.delivery_longitude::double precision as longitude,
      o.delivery_recipient_name as recipient_name,
      o.delivery_phone as recipient_phone,
      o.delivery_address_line as address_line,
      o.delivery_area_name as area_name,
      o.delivery_city as city,
      o.delivery_pin_code as pin_code,
      o.status as order_status,
      o.created_at,
      coalesce((select sum(oi.quantity) from public.order_items oi where oi.order_id=o.id),0)::numeric as quantity_litres
    from public.orders o
    where o.provider_id=p_provider_id
      and o.status in ('ready','out_for_delivery')
      and o.delivery_latitude is not null
      and o.delivery_longitude is not null
      and not exists (
        select 1
        from public.delivery_route_stops s
        join public.delivery_route_runs r on r.id=s.route_id
        where s.order_id=o.id
          and r.status in ('planned','active')
          and s.status in ('pending','arrived')
      )
    order by o.created_at,o.id
    limit v_limit
  ) q;

  return jsonb_build_object(
    'provider_id',p_provider_id,
    'origin',jsonb_build_object('latitude',v_origin.latitude,'longitude',v_origin.longitude),
    'orders',v_orders,
    'limit',v_limit
  );
end;
$delivery_fn$;

create or replace function public.delivery_create_route(
  p_provider_id uuid,
  p_driver_user_id uuid,
  p_service_date date,
  p_planned_start_at timestamptz,
  p_order_ids uuid[],
  p_eta_starts timestamptz[],
  p_eta_ends timestamptz[],
  p_planned_distance_m integer,
  p_planned_duration_s integer,
  p_route_geometry jsonb,
  p_stop_service_seconds integer default 60
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $delivery_fn$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_route_id uuid := gen_random_uuid();
  v_count integer;
  v_distinct integer;
  v_i integer;
  v_order_id uuid;
  v_order record;
begin
  if v_uid is null then raise exception 'authentication_required'; end if;
  select pp.owner_user_id into v_owner
  from public.provider_profiles pp
  where pp.id=p_provider_id
  for update;
  if not found or v_owner<>v_uid then raise exception 'provider_owner_required'; end if;
  if p_service_date is null or p_service_date < (now() at time zone 'Asia/Kolkata')::date then
    raise exception 'invalid_service_date';
  end if;
  if p_planned_start_at is null then raise exception 'planned_start_required'; end if;
  if p_planned_start_at < now() - interval '10 minutes' then raise exception 'planned_start_in_past'; end if;
  if p_planned_distance_m is null or p_planned_distance_m < 0
     or p_planned_duration_s is null or p_planned_duration_s < 0 then
    raise exception 'invalid_route_metrics';
  end if;
  if p_route_geometry is null or jsonb_typeof(p_route_geometry)<>'object'
     or p_route_geometry->>'type'<>'LineString'
     or jsonb_typeof(p_route_geometry->'coordinates')<>'array' then
    raise exception 'invalid_route_geometry';
  end if;
  if octet_length(p_route_geometry::text)>200000 then raise exception 'route_geometry_too_large'; end if;
  if coalesce(p_stop_service_seconds,60) not between 15 and 300 then
    raise exception 'invalid_stop_service_time';
  end if;
  v_count:=coalesce(cardinality(p_order_ids),0);
  if v_count<1 or v_count>99 then raise exception 'route_stop_count_out_of_range'; end if;
  select count(distinct x) into v_distinct from unnest(p_order_ids) x;
  if v_distinct<>v_count or array_position(p_order_ids,null) is not null then
    raise exception 'duplicate_or_null_route_order';
  end if;
  if p_eta_starts is null or p_eta_ends is null
     or cardinality(p_eta_starts)<>v_count or cardinality(p_eta_ends)<>v_count then
    raise exception 'eta_arrays_must_match_route';
  end if;
  if exists(select 1 from unnest(p_eta_starts,p_eta_ends) as eta(starts_at,ends_at)
            where starts_at is null or ends_at is null or ends_at<starts_at) then
    raise exception 'invalid_eta_window';
  end if;
  if not exists (
    select 1 from public.delivery_driver_enrollments e
    join public.delivery_provider_drivers d on d.driver_user_id=e.driver_user_id and d.provider_id=p_provider_id
    where e.driver_user_id=p_driver_user_id and e.is_active and d.is_active
  ) then raise exception 'driver_not_linked_to_provider'; end if;

  for v_i in 1..v_count loop
    v_order_id:=p_order_ids[v_i];
    select o.id,o.status,o.provider_id,o.delivery_latitude,o.delivery_longitude
    into v_order
    from public.orders o
    where o.id=v_order_id;
    if not found or v_order.provider_id<>p_provider_id
       or v_order.status not in ('ready','out_for_delivery')
       or v_order.delivery_latitude is null or v_order.delivery_longitude is null then
      raise exception 'route_order_unavailable:%',v_order_id;
    end if;
    if exists (
      select 1 from public.delivery_route_stops s
      join public.delivery_route_runs r on r.id=s.route_id
      where s.order_id=v_order_id and r.status in ('planned','active')
        and s.status in ('pending','arrived')
    ) then raise exception 'route_order_already_assigned:%',v_order_id; end if;
  end loop;

  insert into public.delivery_route_runs(
    id,provider_id,provider_owner_id,driver_user_id,service_date,status,route_version,
    planned_distance_m,planned_duration_s,planned_start_at,origin_latitude,origin_longitude,
    route_geometry,stop_service_seconds
  )
  select v_route_id,p_provider_id,v_owner,p_driver_user_id,p_service_date,'planned',1,
    p_planned_distance_m,p_planned_duration_s,p_planned_start_at,
    a.latitude,a.longitude,p_route_geometry,coalesce(p_stop_service_seconds,60)
  from public.provider_service_areas a where a.provider_id=p_provider_id;

  if not found then raise exception 'provider_route_origin_not_configured'; end if;

  for v_i in 1..v_count loop
    insert into public.delivery_route_stops(
      route_id,order_id,sequence_no,status,estimated_arrival_at,eta_window_start,eta_window_end
    ) values (
      v_route_id,p_order_ids[v_i],v_i,'pending',
      p_eta_starts[v_i]+((p_eta_ends[v_i]-p_eta_starts[v_i])/2),
      p_eta_starts[v_i],p_eta_ends[v_i]
    );
  end loop;
  return v_route_id;
end;
$delivery_fn$;

create or replace function public.delivery_start_route(p_route_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $delivery_fn$
declare
  v_uid uuid:=auth.uid();
  v_route public.delivery_route_runs%rowtype;
begin
  if v_uid is null then raise exception 'authentication_required'; end if;
  select * into v_route
  from public.delivery_route_runs r
  where r.id=p_route_id and (r.driver_user_id=v_uid or r.provider_owner_id=v_uid)
  for update;
  if not found then raise exception 'route_not_assigned_to_user'; end if;
  if v_route.status='active' then
    return jsonb_build_object('route_id',v_route.id,'status','active','started_at',v_route.started_at);
  end if;
  if v_route.status<>'planned' then raise exception 'route_not_startable'; end if;
  if v_route.planned_start_at is not null and now()<v_route.planned_start_at-interval '30 minutes' then
    raise exception 'route_start_too_early';
  end if;
  if v_route.planned_start_at is not null and now()>v_route.planned_start_at+interval '6 hours' then
    raise exception 'route_start_window_expired';
  end if;
  if not exists(select 1 from public.delivery_route_stops s where s.route_id=p_route_id and s.status='pending') then
    raise exception 'route_has_no_pending_stops';
  end if;
  if exists(
    select 1 from public.delivery_route_stops s
    join public.orders o on o.id=s.order_id
    where s.route_id=p_route_id and o.status not in ('ready','out_for_delivery')
  ) then raise exception 'route_order_not_ready'; end if;

  update public.orders o
  set status='out_for_delivery',status_reason='Delivery route started',updated_at=now()
  from public.delivery_route_stops s
  where s.route_id=p_route_id and s.order_id=o.id and o.status='ready';

  update public.delivery_route_runs
  set status='active',started_at=now(),updated_at=now()
  where id=p_route_id;
  return jsonb_build_object('route_id',p_route_id,'status','active','started_at',now());
end;
$delivery_fn$;

create or replace function public.delivery_update_location(
  p_route_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_m double precision default null,
  p_heading_deg double precision default null,
  p_speed_mps double precision default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $delivery_fn$
declare v_uid uuid:=auth.uid(); v_saved uuid;
begin
  if v_uid is null then raise exception 'authentication_required'; end if;
  if p_latitude is null or p_latitude not between -90 and 90
     or p_longitude is null or p_longitude not between -180 and 180
     or (p_accuracy_m is not null and p_accuracy_m not between 0 and 1000)
     or (p_heading_deg is not null and p_heading_deg not between 0 and 360)
     or (p_speed_mps is not null and p_speed_mps not between 0 and 100) then
    raise exception 'invalid_location_fix';
  end if;
  if not exists(
    select 1 from public.delivery_route_runs r
    where r.id=p_route_id and r.driver_user_id=v_uid and r.status='active'
  ) then raise exception 'active_driver_route_required'; end if;

  insert into public.delivery_live_locations(route_id,latitude,longitude,accuracy_m,heading_deg,speed_mps,updated_at)
  values(p_route_id,p_latitude,p_longitude,p_accuracy_m,p_heading_deg,p_speed_mps,now())
  on conflict(route_id) do update set
    latitude=excluded.latitude,longitude=excluded.longitude,accuracy_m=excluded.accuracy_m,
    heading_deg=excluded.heading_deg,speed_mps=excluded.speed_mps,updated_at=now()
  where public.delivery_live_locations.updated_at < now()-interval '3 seconds'
  returning route_id into v_saved;
  return v_saved is not null;
end;
$delivery_fn$;

create or replace function public.delivery_mark_route_stop_action(
  p_stop_id uuid,
  p_action text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $delivery_fn$
declare
  v_uid uuid:=auth.uid();
  v_stop public.delivery_route_stops%rowtype;
  v_route public.delivery_route_runs%rowtype;
begin
  if v_uid is null then raise exception 'authentication_required'; end if;
  if p_action not in ('arrived','delivered','skipped') then raise exception 'invalid_stop_action'; end if;
  if p_action='skipped' and length(btrim(coalesce(p_reason,''))) not between 3 and 300 then
    raise exception 'skip_reason_required';
  end if;

  -- Always lock the route row before the stop row. ETA refresh takes the same
  -- lock order, avoiding stop/route deadlocks during concurrent driver actions.
  select r.* into v_route
  from public.delivery_route_runs r
  join public.delivery_route_stops s on s.route_id=r.id
  where s.id=p_stop_id
    and (r.driver_user_id=v_uid or r.provider_owner_id=v_uid)
  for update of r;
  if not found then raise exception 'route_stop_not_assigned_to_user'; end if;
  select s.* into v_stop
  from public.delivery_route_stops s
  where s.id=p_stop_id and s.route_id=v_route.id
  for update;
  if not found then raise exception 'route_stop_not_assigned_to_user'; end if;
  if v_route.status<>'active' then raise exception 'active_route_required'; end if;
  if exists(
    select 1 from public.delivery_route_stops previous
    where previous.route_id=v_stop.route_id and previous.sequence_no<v_stop.sequence_no
      and previous.status not in ('delivered','skipped')
  ) then raise exception 'previous_route_stop_not_completed'; end if;

  if p_action='arrived' then
    if v_stop.status<>'pending' then raise exception 'stop_not_pending'; end if;
    update public.delivery_route_stops set status='arrived',arrived_at=now(),updated_at=now()
    where id=p_stop_id;
  elsif p_action='delivered' then
    if v_stop.status<>'arrived' then raise exception 'stop_must_be_marked_arrived_first'; end if;
    update public.orders set status='delivered',status_reason='Delivered by route driver',updated_at=now()
    where id=v_stop.order_id and status='out_for_delivery';
    if not found then raise exception 'order_not_out_for_delivery'; end if;
    update public.delivery_route_stops set status='delivered',delivered_at=now(),updated_at=now()
    where id=p_stop_id;
  else
    if v_stop.status not in ('pending','arrived') then raise exception 'stop_not_skippable'; end if;
    update public.delivery_route_stops set status='skipped',skip_reason=left(btrim(p_reason),300),updated_at=now()
    where id=p_stop_id;
  end if;

  if not exists(
    select 1 from public.delivery_route_stops s
    where s.route_id=v_stop.route_id and s.status in ('pending','arrived')
  ) then
    update public.delivery_route_runs set status='completed',completed_at=now(),updated_at=now()
    where id=v_stop.route_id;
    delete from public.delivery_live_locations where route_id=v_stop.route_id;
  end if;
  perform realtime.send(
    payload => jsonb_build_object(
      'route_id',v_stop.route_id,'stop_id',p_stop_id,'order_id',v_stop.order_id,
      'stop_status',p_action,'skip_reason',case when p_action='skipped' then left(btrim(coalesce(p_reason,'')),300) else null end,
      'updated_at',now()
    ),
    event => 'stop_updated',
    topic => 'delivery-route:'||v_stop.route_id::text,
    private => true
  );
  return jsonb_build_object(
    'route_id',v_stop.route_id,'stop_id',p_stop_id,'action',p_action,
    'route_status',(select r.status from public.delivery_route_runs r where r.id=v_stop.route_id)
  );
end;
$delivery_fn$;

create or replace function public.delivery_get_active_route_eta(p_route_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $delivery_fn$
declare
  v_uid uuid:=auth.uid();
  v_route public.delivery_route_runs%rowtype;
  v_location public.delivery_live_locations%rowtype;
  v_stops jsonb;
begin
  if v_uid is null then raise exception 'authentication_required'; end if;
  select * into v_route
  from public.delivery_route_runs r
  where r.id=p_route_id and r.driver_user_id=v_uid and r.status='active';
  if not found then raise exception 'active_driver_route_required'; end if;

  select * into v_location from public.delivery_live_locations l
  where l.route_id=p_route_id and l.updated_at>now()-interval '2 minutes';
  if not found then raise exception 'fresh_driver_location_required'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'stop_id',s.id,'sequence_no',s.sequence_no,
    'latitude',o.delivery_latitude,'longitude',o.delivery_longitude
  ) order by s.sequence_no),'[]'::jsonb)
  into v_stops
  from public.delivery_route_stops s
  join public.orders o on o.id=s.order_id
  where s.route_id=p_route_id and s.status='pending';

  return jsonb_build_object(
    'route_id',p_route_id,
    'location',jsonb_build_object('latitude',v_location.latitude,'longitude',v_location.longitude,'updated_at',v_location.updated_at),
    'stop_service_seconds',v_route.stop_service_seconds,
    'pending_stops',v_stops
  );
end;
$delivery_fn$;

create or replace function public.delivery_update_remaining_etas(
  p_route_id uuid,
  p_stop_ids uuid[],
  p_eta_starts timestamptz[],
  p_eta_ends timestamptz[]
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $delivery_fn$
declare
  v_uid uuid:=auth.uid();
  v_route public.delivery_route_runs%rowtype;
  v_expected uuid[];
  v_count integer;
  v_i integer;
begin
  if v_uid is null then raise exception 'authentication_required'; end if;
  select * into v_route from public.delivery_route_runs r
  where r.id=p_route_id and r.driver_user_id=v_uid and r.status='active'
  for update;
  if not found then raise exception 'active_driver_route_required'; end if;

  select coalesce(array_agg(s.id order by s.sequence_no),'{}'::uuid[])
  into v_expected
  from public.delivery_route_stops s
  where s.route_id=p_route_id and s.status='pending';
  v_count:=cardinality(v_expected);
  if cardinality(coalesce(p_stop_ids,'{}'::uuid[]))<>v_count
     or p_stop_ids is distinct from v_expected then
    raise exception 'route_stops_changed_refresh_route';
  end if;
  if cardinality(coalesce(p_eta_starts,'{}'::timestamptz[]))<>v_count
     or cardinality(coalesce(p_eta_ends,'{}'::timestamptz[]))<>v_count then
    raise exception 'eta_arrays_must_match_route';
  end if;
  if exists(
    select 1 from unnest(p_eta_starts,p_eta_ends) as eta(starts_at,ends_at)
    where starts_at is null or ends_at is null or ends_at<starts_at
  ) then raise exception 'invalid_eta_window'; end if;

  if v_count>0 then
    for v_i in 1..v_count loop
      update public.delivery_route_stops
      set estimated_arrival_at=p_eta_starts[v_i]+((p_eta_ends[v_i]-p_eta_starts[v_i])/2),
          eta_window_start=p_eta_starts[v_i],
          eta_window_end=p_eta_ends[v_i],
          updated_at=now()
      where id=p_stop_ids[v_i] and route_id=p_route_id and status='pending';
      if not found then raise exception 'route_stops_changed_refresh_route'; end if;
    end loop;
  end if;

  perform realtime.send(
    payload => jsonb_build_object('route_id',p_route_id,'updated_at',now()),
    event => 'eta_updated',
    topic => 'delivery-route:'||p_route_id::text,
    private => true
  );
  return true;
end;
$delivery_fn$;

create or replace function public.delivery_get_my_active_route()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $delivery_fn$
declare
  v_uid uuid:=auth.uid();
  v_route public.delivery_route_runs%rowtype;
  v_stops jsonb;
begin
  if v_uid is null then raise exception 'authentication_required'; end if;
  select * into v_route
  from public.delivery_route_runs r
  where r.driver_user_id=v_uid
    and (
      r.status='active'
      or (r.status='planned' and r.service_date >= (now() at time zone 'Asia/Kolkata')::date)
      or (r.status='completed' and r.service_date=(now() at time zone 'Asia/Kolkata')::date)
    )
  order by
    case when r.status='active' then 0
         when r.status='planned' and r.service_date=(now() at time zone 'Asia/Kolkata')::date then 1
         when r.status='completed' then 2
         else 3 end,
    r.service_date asc,r.created_at desc
  limit 1;
  if not found then return jsonb_build_object('route',null); end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'stop_id',s.id,'order_id',o.id,'sequence_no',s.sequence_no,'stop_status',s.status,
    'order_status',o.status,'eta',s.estimated_arrival_at,'eta_window_start',s.eta_window_start,
    'eta_window_end',s.eta_window_end,'skip_reason',s.skip_reason,'recipient_name',o.delivery_recipient_name,
    'recipient_phone',o.delivery_phone,'address_line',o.delivery_address_line,
    'area_name',o.delivery_area_name,'city',o.delivery_city,'pin_code',o.delivery_pin_code,
    'latitude',o.delivery_latitude,'longitude',o.delivery_longitude,
    'quantity_litres',coalesce((select sum(oi.quantity) from public.order_items oi where oi.order_id=o.id),0)
  ) order by s.sequence_no),'[]'::jsonb)
  into v_stops
  from public.delivery_route_stops s
  join public.orders o on o.id=s.order_id
  where s.route_id=v_route.id;

  return jsonb_build_object(
    'route',jsonb_build_object(
      'id',v_route.id,'status',v_route.status,'service_date',v_route.service_date,
      'planned_start_at',v_route.planned_start_at,'started_at',v_route.started_at,
      'completed_at',v_route.completed_at,'origin_latitude',v_route.origin_latitude,
      'origin_longitude',v_route.origin_longitude,'route_geometry',v_route.route_geometry,
      'planned_distance_m',v_route.planned_distance_m,'planned_duration_s',v_route.planned_duration_s,
      'driver_user_id',v_route.driver_user_id,'provider_id',v_route.provider_id,
      'stops',v_stops
    )
  );
end;
$delivery_fn$;

create or replace function public.delivery_get_my_tracking(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $delivery_fn$
declare
  v_uid uuid:=auth.uid();
  v_order public.orders%rowtype;
  v_stop public.delivery_route_stops%rowtype;
  v_route public.delivery_route_runs%rowtype;
  v_location public.delivery_live_locations%rowtype;
  v_has_location boolean:=false;
begin
  if v_uid is null then raise exception 'authentication_required'; end if;
  select * into v_order from public.orders o where o.id=p_order_id and o.customer_id=v_uid;
  if not found then raise exception 'order_not_owned_or_missing'; end if;

  select s.* into v_stop
  from public.delivery_route_stops s
  where s.order_id=p_order_id
  order by s.created_at desc limit 1;
  if not found then
    return jsonb_build_object(
      'available',false,'order_id',p_order_id,'order_status',v_order.status,
      'message','Your delivery has not been added to a driver route yet.'
    );
  end if;
  select * into v_route from public.delivery_route_runs r where r.id=v_stop.route_id;
  select * into v_location from public.delivery_live_locations l where l.route_id=v_route.id;
  v_has_location:=found and v_route.status='active'
    and v_stop.status in ('pending','arrived')
    and v_location.updated_at>now()-interval '2 minutes';

  return jsonb_build_object(
    'available',true,'order_id',p_order_id,'order_status',v_order.status,
    'route_id',v_route.id,'route_status',v_route.status,'stop_number',v_stop.sequence_no,
    'eta',v_stop.estimated_arrival_at,'eta_window_start',v_stop.eta_window_start,
    'eta_window_end',v_stop.eta_window_end,'stop_status',v_stop.status,'skip_reason',v_stop.skip_reason,
    'destination',jsonb_build_object('latitude',v_order.delivery_latitude,'longitude',v_order.delivery_longitude,
      'address_line',v_order.delivery_address_line,'area_name',v_order.delivery_area_name,'city',v_order.delivery_city),
    'location_stale',not v_has_location,
    'last_location_at',case when v_has_location then v_location.updated_at else null end,
    'location',case when v_has_location then jsonb_build_object(
      'latitude',v_location.latitude,'longitude',v_location.longitude,
      'accuracy_m',v_location.accuracy_m,'heading_deg',v_location.heading_deg,
      'speed_mps',v_location.speed_mps,'updated_at',v_location.updated_at
    ) else null end
  );
end;
$delivery_fn$;

create or replace function private.broadcast_delivery_location()
returns trigger
language plpgsql
security definer
set search_path = ''
as $delivery_fn$
begin
  perform realtime.send(
    payload => jsonb_build_object(
      'route_id',new.route_id,'latitude',new.latitude,'longitude',new.longitude,
      'accuracy_m',new.accuracy_m,'heading_deg',new.heading_deg,
      'speed_mps',new.speed_mps,'updated_at',new.updated_at
    ),
    event => 'location',
    topic => 'delivery-route:'||new.route_id::text,
    private => true
  );
  return new;
end;
$delivery_fn$;

drop trigger if exists delivery_live_location_broadcast on public.delivery_live_locations;
create trigger delivery_live_location_broadcast
after insert or update on public.delivery_live_locations
for each row execute function private.broadcast_delivery_location();

create or replace function private.broadcast_delivery_location_stopped()
returns trigger
language plpgsql
security definer
set search_path = ''
as $delivery_fn$
begin
  perform realtime.send(
    payload => jsonb_build_object('route_id',old.route_id,'updated_at',now()),
    event => 'location_stopped',
    topic => 'delivery-route:'||old.route_id::text,
    private => true
  );
  return old;
end;
$delivery_fn$;

drop trigger if exists delivery_live_location_stopped_broadcast on public.delivery_live_locations;
create trigger delivery_live_location_stopped_broadcast
after delete on public.delivery_live_locations
for each row execute function private.broadcast_delivery_location_stopped();

create or replace function public.delivery_stop_location_sharing(p_route_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $delivery_fn$
declare v_uid uuid:=auth.uid();
begin
  if v_uid is null then raise exception 'authentication_required'; end if;
  if not exists(
    select 1 from public.delivery_route_runs r
    where r.id=p_route_id and r.driver_user_id=v_uid and r.status='active'
  ) then raise exception 'active_driver_route_required'; end if;
  delete from public.delivery_live_locations where route_id=p_route_id;
  return found;
end;
$delivery_fn$;

drop policy if exists "Customers with a route stop can view route run" on public.delivery_route_runs;
create policy "Customers with a route stop can view route run"
on public.delivery_route_runs for select to authenticated
using (
  exists(
    select 1 from public.delivery_route_stops s
    join public.orders o on o.id=s.order_id
    where s.route_id=delivery_route_runs.id and o.customer_id=(select auth.uid())
  )
);

-- Realtime private-channel authorization: customers can join only a route tied to
-- their own order; the assigned driver and provider owner can join their route.
drop policy if exists "Delivery participants can receive private route broadcasts" on realtime.messages;
create policy "Delivery participants can receive private route broadcasts"
on realtime.messages for select to authenticated
using (
  extension='broadcast'
  and exists (
    select 1 from public.delivery_route_runs r
    where realtime.topic()='delivery-route:'||r.id::text
      and (
        r.driver_user_id=(select auth.uid())
        or r.provider_owner_id=(select auth.uid())
        or exists(
          select 1 from public.delivery_route_stops s
          join public.orders o on o.id=s.order_id
          where s.route_id=r.id and o.customer_id=(select auth.uid())
        )
      )
  )
);

revoke all on function public.delivery_driver_enroll() from public,anon;
revoke all on function public.delivery_driver_is_enrolled() from public,anon;
revoke all on function public.delivery_stop_location_sharing(uuid) from public,anon;
revoke all on function public.delivery_driver_opt_out() from public,anon;
revoke all on function public.delivery_provider_link_driver(uuid,uuid) from public,anon;
revoke all on function public.delivery_provider_unlink_driver(uuid,uuid) from public,anon;
revoke all on function public.delivery_list_enrolled_drivers(uuid) from public,anon;
revoke all on function public.delivery_get_route_planning_data(uuid,integer) from public,anon;
revoke all on function public.delivery_create_route(uuid,uuid,date,timestamptz,uuid[],timestamptz[],timestamptz[],integer,integer,jsonb,integer) from public,anon;
revoke all on function public.delivery_start_route(uuid) from public,anon;
revoke all on function public.delivery_update_location(uuid,double precision,double precision,double precision,double precision,double precision) from public,anon;
revoke all on function public.delivery_mark_route_stop_action(uuid,text,text) from public,anon;
revoke all on function public.delivery_get_active_route_eta(uuid) from public,anon;
revoke all on function public.delivery_update_remaining_etas(uuid,uuid[],timestamptz[],timestamptz[]) from public,anon;
revoke all on function public.delivery_get_my_active_route() from public,anon;
revoke all on function public.delivery_get_my_tracking(uuid) from public,anon;

grant execute on function public.delivery_driver_enroll() to authenticated;
grant execute on function public.delivery_driver_is_enrolled() to authenticated;
grant execute on function public.delivery_stop_location_sharing(uuid) to authenticated;
grant execute on function public.delivery_driver_opt_out() to authenticated;
grant execute on function public.delivery_provider_link_driver(uuid,uuid) to authenticated;
grant execute on function public.delivery_provider_unlink_driver(uuid,uuid) to authenticated;
grant execute on function public.delivery_list_enrolled_drivers(uuid) to authenticated;
grant execute on function public.delivery_get_route_planning_data(uuid,integer) to authenticated;
grant execute on function public.delivery_create_route(uuid,uuid,date,timestamptz,uuid[],timestamptz[],timestamptz[],integer,integer,jsonb,integer) to authenticated;
grant execute on function public.delivery_start_route(uuid) to authenticated;
grant execute on function public.delivery_update_location(uuid,double precision,double precision,double precision,double precision,double precision) to authenticated;
grant execute on function public.delivery_mark_route_stop_action(uuid,text,text) to authenticated;
grant execute on function public.delivery_get_active_route_eta(uuid) to authenticated;
grant execute on function public.delivery_update_remaining_etas(uuid,uuid[],timestamptz[],timestamptz[]) to authenticated;
grant execute on function public.delivery_get_my_active_route() to authenticated;
grant execute on function public.delivery_get_my_tracking(uuid) to authenticated;

revoke all on function private.broadcast_delivery_location() from public,anon,authenticated;
revoke all on function private.broadcast_delivery_location_stopped() from public,anon,authenticated;
