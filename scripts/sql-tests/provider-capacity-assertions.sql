-- Verify the existing idempotent checkout, provider-row serialization, local-day guard and grants.
do $$
declare
  body text;
begin
  select pg_get_functiondef('private.create_order_secure(uuid,uuid,jsonb,text,text)'::regprocedure)
  into body;

  if position('FOR UPDATE OF PP' in upper(body)) = 0 then
    raise exception 'idempotent checkout must lock the provider row before checking capacity';
  end if;
  if position('(NOW() AT TIME ZONE ''ASIA/KOLKATA'')::DATE' in upper(body)) = 0 then
    raise exception 'daily litre guard must use Kolkata-local date';
  end if;
  if has_function_privilege('anon','private.create_order_secure(uuid,uuid,jsonb,text,text)','EXECUTE') then
    raise exception 'anon must not execute the secure order function';
  end if;
  if not has_function_privilege('authenticated','private.create_order_secure(uuid,uuid,jsonb,text,text)','EXECUTE') then
    raise exception 'authenticated must retain the idempotent secure checkout entry point';
  end if;
  if has_function_privilege('authenticated','private.create_order_secure(uuid,uuid,jsonb,text)','EXECUTE') then
    raise exception 'authenticated must not execute the obsolete four-argument implementation';
  end if;
  if has_function_privilege('service_role','private.create_order_secure(uuid,uuid,jsonb,text)','EXECUTE') then
    raise exception 'service_role must not execute the obsolete four-argument implementation';
  end if;
end $$;
