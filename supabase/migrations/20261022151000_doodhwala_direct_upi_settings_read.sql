-- Seller-only read path for a provider's own direct UPI settings.
create or replace function public.provider_get_direct_upi_settings()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_result jsonb;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  select jsonb_build_object('upi_id',s.upi_id,'payee_name',s.payee_name,'enabled',s.enabled,'updated_at',s.updated_at)
    into v_result
  from public.provider_payment_settings s
  join public.provider_profiles p on p.id=s.provider_id
  where p.owner_user_id=auth.uid()
  limit 1;
  return coalesce(v_result,'{}'::jsonb);
end;
$$;
revoke execute on function public.provider_get_direct_upi_settings() from public,anon;
grant execute on function public.provider_get_direct_upi_settings() to authenticated;
