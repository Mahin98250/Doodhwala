select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', false);
select public.provider_confirm_direct_upi_payment(
  '30000000-0000-4000-8000-000000000003',
  'UTR123456'
);

do $$
declare
  v_event public.order_payment_events%rowtype;
  v_paid_status text;
begin
  select * into v_event
  from public.order_payment_events
  where order_id = '30000000-0000-4000-8000-000000000003'
  order by created_at desc, id desc
  limit 1;

  if not found then raise exception 'payment_audit_event_missing'; end if;
  if v_event.event_type <> 'direct_upi_seller_attested' then
    raise exception 'unexpected_payment_audit_event:%', v_event.event_type;
  end if;
  if v_event.actor_user_id <> '20000000-0000-4000-8000-000000000002'
     or v_event.actor_role <> 'seller' then
    raise exception 'payment_audit_actor_wrong';
  end if;
  if v_event.payment_reference <> 'UTR123456' then
    raise exception 'payment_audit_reference_missing';
  end if;
  if v_event.amount_paise <> 6800 then
    raise exception 'payment_audit_amount_wrong:%', v_event.amount_paise;
  end if;

  select payment_status into v_paid_status
  from public.orders
  where id = '30000000-0000-4000-8000-000000000003';
  if v_paid_status <> 'paid_direct_to_seller' then
    raise exception 'seller_confirmation_did_not_update_order';
  end if;
end
$$;

do $$
begin
  begin
    update public.order_payment_events
    set payment_reference = 'MUTATED'
    where order_id = '30000000-0000-4000-8000-000000000003';
    raise exception 'payment_audit_mutation_was_not_blocked';
  exception
    when others then
      if sqlerrm = 'payment_audit_mutation_was_not_blocked' then raise; end if;
      if sqlerrm <> 'payment_audit_events_are_immutable' then raise; end if;
  end;
end
$$;

do $$
begin
  begin
    perform public.provider_confirm_direct_upi_payment(
      '30000000-0000-4000-8000-000000000003',
      'bad'
    );
    raise exception 'short_payment_reference_was_accepted';
  exception
    when others then
      if sqlerrm = 'short_payment_reference_was_accepted' then raise; end if;
      if sqlerrm <> 'payment_reference_required' then raise; end if;
  end;

  if has_table_privilege('authenticated', 'public.order_payment_events', 'INSERT') then
    raise exception 'authenticated_role_can_insert_audit_events';
  end if;
  if has_table_privilege('authenticated', 'public.order_payment_events', 'UPDATE') then
    raise exception 'authenticated_role_can_update_audit_events';
  end if;
  if has_table_privilege('authenticated', 'public.order_payment_events', 'DELETE') then
    raise exception 'authenticated_role_can_delete_audit_events';
  end if;
end
$$;

select 'payment audit migration assertions passed' as result;
