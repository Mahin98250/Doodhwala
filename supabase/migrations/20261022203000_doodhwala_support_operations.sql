-- Doodhwala support operations: owner-only queue and ticket hardening.
-- Customer requests are always scoped to auth.uid(); only allowlisted owners can triage tickets.
create or replace function public.create_support_ticket(
  p_subject text,
  p_description text,
  p_category text default 'general',
  p_order_id uuid default null
)
returns public.support_tickets
language plpgsql
security definer
set search_path = ''
as $function$
declare
  r public.support_tickets;
  v_category text := lower(trim(coalesce(p_category, 'general')));
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if length(trim(coalesce(p_subject,''))) < 3 or length(trim(coalesce(p_subject,''))) > 120 then
    raise exception 'Subject must be between 3 and 120 characters';
  end if;
  if length(trim(coalesce(p_description,''))) < 5 or length(trim(coalesce(p_description,''))) > 2000 then
    raise exception 'Description must be between 5 and 2000 characters';
  end if;
  if v_category not in ('general','delivery','order','payment','subscription','seller','product') then
    raise exception 'Unsupported support category';
  end if;
  if p_order_id is not null and not exists (
    select 1 from public.orders o
    where o.id = p_order_id and o.customer_id = auth.uid()
  ) then
    raise exception 'Order not found for this account';
  end if;
  insert into public.support_tickets(customer_id,order_id,category,subject,description)
  values(auth.uid(),p_order_id,v_category,trim(p_subject),trim(p_description))
  returning * into r;
  return r;
end;
$function$;

create or replace function public.admin_list_support_tickets(
  p_status text default null,
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  result jsonb;
begin
  if not coalesce(private.is_current_user_admin(), false) then
    raise exception 'Owner access required' using errcode = '42501';
  end if;
  if p_status is not null and p_status not in ('open','in_progress','resolved','closed') then
    raise exception 'Unsupported ticket status';
  end if;
  select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc), '[]'::jsonb)
  into result
  from (
    select t.id, t.customer_id, p.full_name as customer_name, p.account_type as customer_account_type,
           t.order_id, t.category, t.subject, t.description, t.status, t.priority,
           t.created_at, t.updated_at
    from public.support_tickets t
    left join public.profiles p on p.id=t.customer_id
    where p_status is null or t.status=p_status
    order by t.created_at desc
    limit greatest(1, least(coalesce(p_limit,100),200))
  ) q;
  return result;
end;
$function$;

create or replace function public.admin_update_support_ticket(
  p_ticket_id uuid,
  p_status text,
  p_priority text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  updated public.support_tickets;
begin
  if not coalesce(private.is_current_user_admin(), false) then
    raise exception 'Owner access required' using errcode = '42501';
  end if;
  if p_status not in ('open','in_progress','resolved','closed') then
    raise exception 'Unsupported ticket status';
  end if;
  if p_priority is not null and p_priority not in ('low','normal','high','urgent') then
    raise exception 'Unsupported ticket priority';
  end if;
  update public.support_tickets
  set status=p_status,
      priority=coalesce(p_priority,priority),
      updated_at=now()
  where id=p_ticket_id
  returning * into updated;
  if not found then raise exception 'Support ticket not found'; end if;
  return to_jsonb(updated);
end;
$function$;

revoke all on function public.create_support_ticket(text,text,text,uuid) from public, anon;
grant execute on function public.create_support_ticket(text,text,text,uuid) to authenticated;
revoke all on function public.admin_list_support_tickets(text,integer) from public, anon;
grant execute on function public.admin_list_support_tickets(text,integer) to authenticated;
revoke all on function public.admin_update_support_ticket(uuid,text,text) from public, anon;
grant execute on function public.admin_update_support_ticket(uuid,text,text) to authenticated;
