-- Smart milk delivery: route runs, ordered stops and privacy-scoped live location.
-- Additive foundation only. Do not apply to production until staging review and tests pass.

create table if not exists public.delivery_route_runs (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.provider_profiles(id) on delete restrict,
  provider_owner_id uuid not null,
  driver_user_id uuid not null references public.profiles(id) on delete restrict,
  service_date date not null default (now() at time zone 'Asia/Kolkata')::date,
  status text not null default 'planned' check (status in ('planned','active','completed','cancelled')),
  route_version integer not null default 1 check (route_version > 0),
  planned_distance_m integer check (planned_distance_m is null or planned_distance_m >= 0),
  planned_duration_s integer check (planned_duration_s is null or planned_duration_s >= 0),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.delivery_route_stops (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.delivery_route_runs(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete restrict,
  sequence_no integer not null check (sequence_no > 0),
  status text not null default 'pending' check (status in ('pending','arrived','delivered','skipped')),
  estimated_arrival_at timestamptz,
  eta_window_start timestamptz,
  eta_window_end timestamptz,
  arrived_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (route_id, order_id),
  unique (route_id, sequence_no),
  check (eta_window_start is null or eta_window_end is null or eta_window_end >= eta_window_start)
);

-- Retain only the latest location fix, not a permanent GPS breadcrumb trail.
create table if not exists public.delivery_live_locations (
  route_id uuid primary key references public.delivery_route_runs(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_m double precision check (accuracy_m is null or accuracy_m >= 0),
  heading_deg double precision check (heading_deg is null or heading_deg between 0 and 360),
  speed_mps double precision check (speed_mps is null or speed_mps >= 0),
  updated_at timestamptz not null default now()
);

create index if not exists delivery_route_runs_driver_date_idx on public.delivery_route_runs(driver_user_id, service_date, status);
create index if not exists delivery_route_runs_provider_date_idx on public.delivery_route_runs(provider_id, service_date, status);
create index if not exists delivery_route_stops_order_idx on public.delivery_route_stops(order_id);
create index if not exists delivery_route_stops_route_status_sequence_idx on public.delivery_route_stops(route_id, status, sequence_no);
create index if not exists delivery_route_stops_eta_idx on public.delivery_route_stops(estimated_arrival_at) where status = 'pending';

alter table public.delivery_route_runs enable row level security;
alter table public.delivery_route_stops enable row level security;
alter table public.delivery_live_locations enable row level security;

revoke all on public.delivery_route_runs from anon, authenticated;
revoke all on public.delivery_route_stops from anon, authenticated;
revoke all on public.delivery_live_locations from anon, authenticated;
grant select on public.delivery_route_runs to authenticated;
grant select on public.delivery_route_stops to authenticated;
grant select on public.delivery_live_locations to authenticated;

drop policy if exists "Assigned delivery team can view route runs" on public.delivery_route_runs;
create policy "Assigned delivery team can view route runs"
on public.delivery_route_runs for select to authenticated
using (driver_user_id = (select auth.uid()) or provider_owner_id = (select auth.uid()));

drop policy if exists "Assigned delivery team and order customer can view route stops" on public.delivery_route_stops;
create policy "Assigned delivery team and order customer can view route stops"
on public.delivery_route_stops for select to authenticated
using (
  exists (
    select 1 from public.delivery_route_runs r
    where r.id = delivery_route_stops.route_id
      and (r.driver_user_id = (select auth.uid()) or r.provider_owner_id = (select auth.uid()))
  )
  or exists (
    select 1 from public.orders o
    where o.id = delivery_route_stops.order_id and o.customer_id = (select auth.uid())
  )
);

drop policy if exists "Only route customers and assigned team can view live position" on public.delivery_live_locations;
create policy "Only route customers and assigned team can view live position"
on public.delivery_live_locations for select to authenticated
using (
  exists (
    select 1 from public.delivery_route_runs r
    where r.id = delivery_live_locations.route_id
      and (r.driver_user_id = (select auth.uid()) or r.provider_owner_id = (select auth.uid()))
  )
  or exists (
    select 1
    from public.delivery_route_stops s
    join public.orders o on o.id = s.order_id
    where s.route_id = delivery_live_locations.route_id
      and o.customer_id = (select auth.uid())
      and s.status in ('pending','arrived')
  )
);

comment on table public.delivery_route_runs is 'One provider-assigned milk delivery route for a driver and service date; create and reorder via trusted backend only.';
comment on table public.delivery_route_stops is 'Ordered stops; customers can read only their own stop while the assigned driver/provider can read the full route.';
comment on table public.delivery_live_locations is 'Latest active-route GPS fix only; writes require a trusted backend that verifies driver assignment.';
