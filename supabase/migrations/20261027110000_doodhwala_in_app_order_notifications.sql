-- In-app order notifications for customers and local milk providers.
-- Push notifications are intentionally not claimed: no push provider is configured.
create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_event_id uuid not null references public.order_status_events(id) on delete cascade,
  related_order_id uuid not null references public.orders(id) on delete cascade,
  category text not null default 'order' check (category in ('order')),
  title text not null check (length(title) between 1 and 120),
  body text not null check (length(body) between 1 and 500),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (user_id, source_event_id)
);

create index if not exists user_notifications_user_created_idx
  on public.user_notifications(user_id, created_at desc);
create index if not exists user_notifications_unread_idx
  on public.user_notifications(user_id, created_at desc)
  where read_at is null;

alter table public.user_notifications enable row level security;
revoke all on table public.user_notifications from public, anon, authenticated;

create or replace function public.create_order_status_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_customer_id uuid;
  v_provider_owner_id uuid;
  v_customer_title text;
  v_customer_body text;
begin
  select o.customer_id, o.provider_owner_id
    into v_customer_id, v_provider_owner_id
    from public.orders o
   where o.id = new.order_id;

  if not found then
    return new;
  end if;

  case new.to_status
    when 'placed' then
      v_customer_title := 'Order received';
      v_customer_body := 'Your order has been placed with a local milk provider.';
    when 'accepted' then
      v_customer_title := 'Order accepted';
      v_customer_body := 'Your milk provider accepted your order.';
    when 'preparing' then
      v_customer_title := 'Order being prepared';
      v_customer_body := 'Your milk provider is preparing your order.';
    when 'ready' then
      v_customer_title := 'Order ready';
      v_customer_body := 'Your order is ready for delivery.';
    when 'out_for_delivery' then
      v_customer_title := 'Order on the way';
      v_customer_body := 'Your order is out for delivery.';
    when 'delivered' then
      v_customer_title := 'Order delivered';
      v_customer_body := 'Your order has been marked as delivered.';
    when 'rejected' then
      v_customer_title := 'Order declined';
      v_customer_body := 'Your milk provider could not accept this order.';
    when 'cancelled' then
      v_customer_title := 'Order cancelled';
      v_customer_body := 'Your order was cancelled.';
    else
      v_customer_title := 'Order update';
      v_customer_body := 'There is an update to your order.';
  end case;

  if v_customer_id is not null then
    insert into public.user_notifications(
      user_id, source_event_id, related_order_id, category, title, body
    )
    values (
      v_customer_id, new.id, new.order_id, 'order', v_customer_title, v_customer_body
    )
    on conflict (user_id, source_event_id) do nothing;
  end if;

  -- Notify the provider only when a new order is placed; subsequent status
  -- changes are actions they performed and should not create self-notifications.
  if new.to_status = 'placed' and v_provider_owner_id is not null then
    insert into public.user_notifications(
      user_id, source_event_id, related_order_id, category, title, body
    )
    values (
      v_provider_owner_id, new.id, new.order_id, 'order',
      'New order received', 'A new customer order is waiting for your review.'
    )
    on conflict (user_id, source_event_id) do nothing;
  end if;

  return new;
end
$function$;

drop trigger if exists order_status_events_notify on public.order_status_events;
create trigger order_status_events_notify
  after insert on public.order_status_events
  for each row execute function public.create_order_status_notifications();

revoke all on function public.create_order_status_notifications() from public, anon, authenticated;

create or replace function public.get_my_notifications(
  p_limit integer default 50,
  p_before timestamptz default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_items jsonb;
  v_unread_count bigint;
begin
  if v_uid is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  select coalesce(jsonb_agg(to_jsonb(n) order by n.created_at desc), '[]'::jsonb)
    into v_items
    from (
      select id, title, body, category, related_order_id, created_at, read_at
        from public.user_notifications
       where user_id = v_uid
         and (p_before is null or created_at < p_before)
       order by created_at desc
       limit greatest(1, least(coalesce(p_limit, 50), 100))
    ) n;

  select count(*) into v_unread_count
    from public.user_notifications
   where user_id = v_uid and read_at is null;

  return jsonb_build_object('items', v_items, 'unread_count', v_unread_count);
end
$function$;

create or replace function public.mark_my_notification_read(p_notification_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_notification public.user_notifications%rowtype;
begin
  if v_uid is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if p_notification_id is null then
    raise exception 'notification_id_required' using errcode = '22023';
  end if;

  update public.user_notifications n
     set read_at = coalesce(n.read_at, now())
   where n.id = p_notification_id and n.user_id = v_uid
  returning * into v_notification;

  if not found then
    raise exception 'notification_not_found' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'id', v_notification.id,
    'read_at', v_notification.read_at,
    'related_order_id', v_notification.related_order_id
  );
end
$function$;

create or replace function public.mark_all_my_notifications_read()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_updated integer := 0;
begin
  if v_uid is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  update public.user_notifications n
     set read_at = now()
   where n.user_id = v_uid and n.read_at is null;
  get diagnostics v_updated = row_count;

  return jsonb_build_object('updated_count', v_updated);
end
$function$;

revoke all on function public.get_my_notifications(integer, timestamptz) from public, anon, authenticated;
grant execute on function public.get_my_notifications(integer, timestamptz) to authenticated;

revoke all on function public.mark_my_notification_read(uuid) from public, anon, authenticated;
grant execute on function public.mark_my_notification_read(uuid) to authenticated;

revoke all on function public.mark_all_my_notifications_read() from public, anon, authenticated;
grant execute on function public.mark_all_my_notifications_read() to authenticated;

comment on table public.user_notifications is
  'In-app order notifications scoped to the recipient. Push delivery is not configured by this migration.';
