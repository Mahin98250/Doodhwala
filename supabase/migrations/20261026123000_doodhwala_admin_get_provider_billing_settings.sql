-- Owner-only read endpoint for the Doodhwala seller billing destination.
create or replace function public.admin_get_provider_billing_settings()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_result jsonb;
begin
  if auth.uid() is null or not private.is_current_user_admin() then
    raise exception 'admin_access_required';
  end if;
  select jsonb_build_object(
    'payee_name',s.payee_name,
    'upi_id',s.upi_id,
    'instructions',s.instructions,
    'updated_at',s.updated_at
  ) into v_result
  from public.provider_billing_settings s
  where s.singleton = true;
  return v_result;
end;
$$;
revoke all on function public.admin_get_provider_billing_settings() from public, anon, authenticated;
grant execute on function public.admin_get_provider_billing_settings() to authenticated;
