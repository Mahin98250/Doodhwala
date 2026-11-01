-- Require the allowlisted admin identity to match a confirmed Auth email.
-- A stale/forged/mismatched email claim must not grant owner permissions.

create or replace function private.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.admin_allowlist as a
    join auth.users as u on u.id = auth.uid()
    where auth.uid() is not null
      and u.email_confirmed_at is not null
      and lower(trim(a.user_email)) = lower(u.email)
      and lower(u.email) = lower(coalesce(auth.jwt()->>'email', ''))
  );
$$;

revoke all on function private.is_current_user_admin() from public, anon;
grant execute on function private.is_current_user_admin() to authenticated;

comment on function private.is_current_user_admin() is
  'Returns true only when the authenticated user has a confirmed Auth email matching both the signed JWT email and the private admin allowlist.';
