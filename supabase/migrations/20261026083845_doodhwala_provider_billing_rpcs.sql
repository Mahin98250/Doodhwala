-- Secure RPC surface for provider monthly billing.
create or replace function public.provider_get_my_billing()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_uid uuid:=auth.uid(); v_provider_id uuid; v_result jsonb;
begin
 if v_uid is null then raise exception 'authentication_required'; end if;
 select p.id into v_provider_id from public.provider_profiles p
 where p.owner_user_id=v_uid order by p.created_at desc limit 1;
 if v_provider_id is null then raise exception 'provider_not_found'; end if;
 select jsonb_build_object(
  'billing_instructions',(select jsonb_build_object('payee_name',s.payee_name,'upi_id',s.upi_id,'instructions',s.instructions) from public.provider_billing_settings s where s.singleton=true),
  'invoices',coalesce((select jsonb_agg(jsonb_build_object(
   'id',i.id,'invoice_number',i.invoice_number,'plan_name',i.plan_name_snapshot,
   'amount_paise',i.amount_paise,'currency',i.currency,'period_start',i.period_start,
   'period_end',i.period_end,'due_date',i.due_date,'status',i.status,
   'created_at',i.created_at,'paid_at',i.paid_at,'notes',i.notes,
   'payments',coalesce((select jsonb_agg(jsonb_build_object('amount_paise',p.amount_paise,'method',p.method,'reference',p.reference,'received_at',p.received_at) order by p.created_at desc) from public.provider_subscription_payments p where p.invoice_id=i.id),'[]'::jsonb)
  ) order by i.created_at desc) from public.provider_subscription_invoices i where i.provider_id=v_provider_id),'[]'::jsonb)
 ) into v_result;
 return v_result;
end $$;
revoke all on function public.provider_get_my_billing() from public,anon;
grant execute on function public.provider_get_my_billing() to authenticated;

create or replace function public.admin_upsert_provider_billing_plan(
 p_plan_id uuid,p_name text,p_amount_paise bigint,p_description text default '',p_is_active boolean default true
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if auth.uid() is null or not coalesce(private.is_current_user_admin(), false) then raise exception 'admin_access_required'; end if;
 if length(trim(coalesce(p_name,'')))<2 or length(trim(p_name))>80 then raise exception 'invalid_plan_name'; end if;
 if p_amount_paise is null or p_amount_paise<=0 then raise exception 'invalid_plan_amount'; end if;
 if p_plan_id is null then
  insert into public.provider_billing_plans(name,amount_paise,description,is_active)
  values(trim(p_name),p_amount_paise,left(coalesce(p_description,''),1000),coalesce(p_is_active,true))
  returning id into v_id;
 else
  update public.provider_billing_plans set name=trim(p_name),amount_paise=p_amount_paise,
   description=left(coalesce(p_description,''),1000),is_active=coalesce(p_is_active,true),updated_at=now()
  where id=p_plan_id returning id into v_id;
  if v_id is null then raise exception 'billing_plan_not_found'; end if;
 end if;
 return v_id;
end $$;
revoke all on function public.admin_upsert_provider_billing_plan(uuid,text,bigint,text,boolean) from public,anon,authenticated;
grant execute on function public.admin_upsert_provider_billing_plan(uuid,text,bigint,text,boolean) to authenticated;

create or replace function public.admin_create_provider_subscription_invoice(
 p_provider_id uuid,p_plan_id uuid,p_period_start date,p_period_end date,p_due_date date,
 p_invoice_number text,p_notes text default ''
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_plan public.provider_billing_plans%rowtype; v_id uuid;
begin
 if auth.uid() is null or not coalesce(private.is_current_user_admin(), false) then raise exception 'admin_access_required'; end if;
 if p_period_start is null or p_period_end is null or p_due_date is null or p_period_end<p_period_start then raise exception 'invalid_billing_period'; end if;
 if length(trim(coalesce(p_invoice_number,'')))<3 or length(trim(p_invoice_number))>80 then raise exception 'invalid_invoice_number'; end if;
 if not exists(select 1 from public.provider_profiles p where p.id=p_provider_id) then raise exception 'provider_not_found'; end if;
 select * into v_plan from public.provider_billing_plans where id=p_plan_id and is_active=true;
 if not found then raise exception 'active_billing_plan_not_found'; end if;
 insert into public.provider_subscription_invoices(provider_id,plan_id,plan_name_snapshot,amount_paise,period_start,period_end,due_date,invoice_number,notes,created_by)
 values(p_provider_id,v_plan.id,v_plan.name,v_plan.amount_paise,p_period_start,p_period_end,p_due_date,trim(p_invoice_number),left(coalesce(p_notes,''),1000),auth.uid())
 returning id into v_id;
 return v_id;
end $$;
revoke all on function public.admin_create_provider_subscription_invoice(uuid,uuid,date,date,date,text,text) from public,anon,authenticated;
grant execute on function public.admin_create_provider_subscription_invoice(uuid,uuid,date,date,date,text,text) to authenticated;

create or replace function public.admin_record_provider_subscription_payment(
 p_invoice_id uuid,p_amount_paise bigint,p_method text,p_reference text,
 p_received_at timestamptz default now(),p_notes text default ''
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_invoice public.provider_subscription_invoices%rowtype; v_payment_id uuid;
begin
 if auth.uid() is null or not coalesce(private.is_current_user_admin(), false) then raise exception 'admin_access_required'; end if;
 if p_amount_paise is null or p_amount_paise<=0 then raise exception 'invalid_payment_amount'; end if;
 if p_method not in ('manual_upi','bank_transfer','cash') then raise exception 'invalid_payment_method'; end if;
 if length(trim(coalesce(p_reference,'')))<3 or length(trim(p_reference))>120 then raise exception 'payment_reference_required'; end if;
 select * into v_invoice from public.provider_subscription_invoices where id=p_invoice_id for update;
 if not found then raise exception 'invoice_not_found'; end if;
 if v_invoice.status<>'due' then raise exception 'invoice_not_due'; end if;
 if p_amount_paise<>v_invoice.amount_paise then raise exception 'payment_amount_mismatch'; end if;
 insert into public.provider_subscription_payments(invoice_id,provider_id,amount_paise,method,reference,received_at,recorded_by,notes)
 values(v_invoice.id,v_invoice.provider_id,p_amount_paise,p_method,trim(p_reference),coalesce(p_received_at,now()),auth.uid(),left(coalesce(p_notes,''),1000))
 returning id into v_payment_id;
 update public.provider_subscription_invoices set status='paid',paid_at=coalesce(p_received_at,now())
 where id=v_invoice.id and status='due';
 if not found then raise exception 'invoice_state_changed'; end if;
 return v_payment_id;
end $$;
revoke all on function public.admin_record_provider_subscription_payment(uuid,bigint,text,text,timestamptz,text) from public,anon,authenticated;
grant execute on function public.admin_record_provider_subscription_payment(uuid,bigint,text,text,timestamptz,text) to authenticated;

create or replace function public.admin_set_provider_billing_settings(p_payee_name text,p_upi_id text,p_instructions text default null)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not coalesce(private.is_current_user_admin(), false) then raise exception 'admin_access_required'; end if;
 if length(trim(coalesce(p_payee_name,'')))<2 or length(trim(p_payee_name))>120 then raise exception 'invalid_payee_name'; end if;
 if length(trim(coalesce(p_upi_id,'')))<3 or length(trim(p_upi_id))>255 or p_upi_id !~ '^[A-Za-z0-9._-]{2,200}@[A-Za-z0-9.-]{2,100}$' then raise exception 'invalid_upi_id'; end if;
 insert into public.provider_billing_settings(singleton,payee_name,upi_id,instructions,updated_by,updated_at)
 values(true,trim(p_payee_name),trim(p_upi_id),left(coalesce(p_instructions,'Pay the exact invoice amount and include the invoice number in the payment note.'),1000),auth.uid(),now())
 on conflict(singleton) do update set payee_name=excluded.payee_name,upi_id=excluded.upi_id,instructions=excluded.instructions,updated_by=excluded.updated_by,updated_at=now();
 return true;
end $$;
revoke all on function public.admin_set_provider_billing_settings(text,text,text) from public,anon,authenticated;
grant execute on function public.admin_set_provider_billing_settings(text,text,text) to authenticated;
