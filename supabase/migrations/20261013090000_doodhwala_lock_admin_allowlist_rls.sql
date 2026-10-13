-- The admin allowlist is intentionally private and must not be directly queryable.
-- Enable RLS without adding client policies. The table owner used by the tightly
-- scoped SECURITY DEFINER authorization helper can still read the allowlist.
ALTER TABLE private.admin_allowlist ENABLE ROW LEVEL SECURITY;
