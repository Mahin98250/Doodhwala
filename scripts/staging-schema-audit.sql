-- Doodhwala staging schema audit: READ-ONLY diagnostics only.
-- Verify your SQL editor is connected to the intended STAGING project before running.
-- No DDL/DML statements are present in this file.

select
  current_database() as database_name,
  current_user as database_role,
  current_setting('server_version') as postgres_version,
  now() as observed_at;

-- Migration history is managed by Supabase. This query only reads it.
select version, name
from supabase_migrations.schema_migrations
order by version desc
limit 100;

-- Public tables and approximate live row counts (statistics are estimates).
select schemaname, relname as table_name, n_live_tup as estimated_rows,
       pg_size_pretty(pg_total_relation_size(format('%I.%I', schemaname, relname)::regclass)) as total_size
from pg_stat_user_tables
where schemaname = 'public'
order by pg_total_relation_size(format('%I.%I', schemaname, relname)::regclass) desc;

-- Indexes and their use statistics; low scan counts alone do not justify dropping indexes.
select schemaname, relname as table_name, indexrelname as index_name,
       idx_scan, idx_tup_read, idx_tup_fetch
from pg_stat_user_indexes
where schemaname = 'public'
order by relname, indexrelname;

-- Recent slow/expensive function names are not exposed by this query; use Supabase
-- Query Performance / Logs for query plans, latency, errors and lock waits.
-- Inspect exposed routines and their security mode/grants for review.
select n.nspname as schema_name, p.proname as function_name,
       p.prosecdef as security_definer,
       pg_get_function_identity_arguments(p.oid) as arguments,
       p.proconfig as function_settings
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'private')
order by n.nspname, p.proname;

-- RLS status for public tables.
select n.nspname as schema_name, c.relname as table_name,
       c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'p')
order by c.relname;

-- Active indexes (definitions only; use EXPLAIN (ANALYZE, BUFFERS) on representative
-- synthetic staging queries before changing indexes).
select schemaname, tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
order by tablename, indexname;
