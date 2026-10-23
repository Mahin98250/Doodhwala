import assert from "node:assert/strict";
import fs from "node:fs";

const migrationPath = "supabase/migrations/20261023120000_doodhwala_bounded_nearby_provider_search.sql";
const baseMigrationPath = "supabase/migrations/20261007_doodhwala_marketplace.sql";
const migration = fs.readFileSync(migrationPath, "utf8");
const baseMigration = fs.readFileSync(baseMigrationPath, "utf8");
const compact = value => value.replace(/\s+/g, " ").toLowerCase();

// Preserve the RPC contract and its existing authorization model.
assert.match(migration, /create or replace function public\.find_nearby_providers_v2\s*\(/i);
assert.match(migration, /returns table\s*\([\s\S]*?provider_id uuid[\s\S]*?products jsonb\s*\)/i);
assert.match(migration, /language sql\s+security invoker/i);
assert.match(migration, /set search_path\s*=\s*public,\s*pg_temp/i);
assert.match(migration, /revoke execute on function public\.find_nearby_providers_v2\(numeric, numeric, numeric\) from public/i);
assert.match(migration, /grant execute on function public\.find_nearby_providers_v2\(numeric, numeric, numeric\) to anon, authenticated/i);

// Candidate providers should be reduced with an indexed coordinate bounding box
// before the exact haversine-style distance calculation.
assert.match(migration, /provider_service_areas\s+psa\s+on\s+psa\.provider_id\s*=\s*pp\.id/i);
assert.match(migration, /psa\.latitude between/i);
assert.match(migration, /longitude_delta/i);
assert.match(migration, /scored\.distance_km <= s\.max_km/i);
assert.match(migration, /6371\.0\s*\*\s*2\s*\*\s*asin/i);
assert.match(migration, /center_longitude - s\.longitude_delta < -180/i);
assert.match(migration, /center_longitude \+ s\.longitude_delta > 180/i);

// Do not aggregate every active product in the whole marketplace on every search.
// Aggregate stock products through an index-friendly provider_id lookup for each
// provider that survives the location/radius filter.
assert.match(migration, /left join lateral\s*\(/i);
assert.match(migration, /where mp\.provider_id = b\.id\s+and mp\.is_active\s+and mp\.stock/i);
assert.doesNotMatch(migration, /product_groups\s+as\s*\(/i);

// Confirm the existing schema migration supplies the supporting B-tree indexes.
const base = compact(baseMigration);
assert.match(base, /create index if not exists provider_service_areas_lat_lng_idx on public\.provider_service_areas\(latitude, longitude\)/);
assert.match(base, /create index if not exists milk_products_active_idx on public\.milk_products\(provider_id, is_active, stock\)/);

console.log("PASS: nearby provider discovery keeps its RPC/security contract, bounds geo candidates, and aggregates products per nearby provider.");
