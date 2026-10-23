import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");
const migration = read("supabase/migrations/20261023130000_doodhwala_order_capacity_query_indexes.sql");
const fixture = read("scripts/sql-tests/nearby-search-fixture.sql");
const assertions = read("scripts/sql-tests/nearby-search-assertions.sql");
const workflow = read(".github/workflows/sql-migration-validation.yml");

// Match the predicates in private.create_order_secure; never change the actual limits
// or remove the serialization/capacity checks to make a load test pass.
assert.match(migration, /create index if not exists orders_provider_open_capacity_idx\s+on public\.orders\s*\(provider_id\)\s+where status in\s*\('placed','accepted','preparing','ready','out_for_delivery'\)/i);
assert.match(migration, /create index if not exists orders_provider_daily_litres_idx\s+on public\.orders\s*\(\s*provider_id,\s*\(\(created_at at time zone 'Asia\/Kolkata'\)::date\)\s*\)\s+where status not in\s*\('rejected','cancelled'\)/i);
assert.match(migration, /comment on index public\.orders_provider_open_capacity_idx/i);
assert.match(migration, /comment on index public\.orders_provider_daily_litres_idx/i);
assert.doesNotMatch(migration, /\b(drop index|drop table|truncate|delete from|update public\.orders|insert into public\.orders)\b/i);

// The isolated PostgreSQL integration test must build the minimal required table and
// assert both real indexes exist after applying the migration.
assert.match(fixture, /create table public\.orders\s*\([\s\S]*?provider_id uuid not null[\s\S]*?status text not null[\s\S]*?created_at timestamptz not null/i);
assert.match(assertions, /orders_provider_open_capacity_idx/);
assert.match(assertions, /orders_provider_daily_litres_idx/);
assert.match(workflow, /20261023130000_doodhwala_order_capacity_query_indexes\.sql/);

console.log("PASS: order-capacity index contracts preserve capacity predicates and are covered by PostgreSQL migration validation.");
