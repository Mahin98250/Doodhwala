import assert from "node:assert/strict";
import fs from "node:fs";

const read = path => fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");
const migration = read("supabase/migrations/20261026140000_doodhwala_paginated_provider_discovery.sql");
const app = read("app.js");
const html = read("index.html");
const sw = read("sw.js");
const sqlWorkflow = read(".github/workflows/sql-migration-validation.yml");
const staticWorkflow = read(".github/workflows/static-validation.yml");
const assertions = read("scripts/sql-tests/nearby-search-assertions.sql");
const loadScenario = read("scripts/load-tests/nearby-provider-search.k6.js");

// The old v2 function stays intact for compatibility; v3 is additive.
assert.match(migration, /create or replace function public\.find_nearby_providers_v3\s*\(/i);
assert.match(migration, /returns table\s*\([\s\S]*?provider_id uuid[\s\S]*?products jsonb\s*\)/i);
assert.match(migration, /language sql\s+security invoker/i);
assert.match(migration, /set search_path\s*=\s*public,\s*pg_temp/i);
assert.match(migration, /least\(greatest\(coalesce\(p_limit, 24\), 1\), 50\)/i);
assert.match(migration, /least\(greatest\(coalesce\(p_offset, 0\), 0\), 5000\)/i);
assert.match(migration, /case when p_sort in \('closest','rating','price'\) then p_sort else 'closest' end/i);
assert.match(migration, /revoke execute on function public\.find_nearby_providers_v3\(numeric, numeric, numeric, text, integer, integer\) from public/i);
assert.match(migration, /grant execute on function public\.find_nearby_providers_v3\(numeric, numeric, numeric, text, integer, integer\) to anon, authenticated/i);

// Page selection must happen before the lateral product aggregate, so products are
// fetched only for the page that is returned instead of every nearby provider.
assert.ok(migration.indexOf("paged_providers as") < migration.indexOf("left join lateral"), "provider paging must happen before product aggregation");
assert.match(migration, /limit \(select page_limit from search_params\)/i);
assert.match(migration, /offset \(select page_offset from search_params\)/i);
assert.match(migration, /n\.id\s*$/m, "stable ordering must use provider ID as a final tie-breaker");

// Browser requests are bounded (24 displayed + 1 look-ahead), with a load-more action.
assert.match(app, /const DISCOVERY_PAGE_SIZE=24/);
assert.match(app, /const DISCOVERY_FETCH_SIZE=DISCOVERY_PAGE_SIZE\+1/);
assert.match(app, /rpc\("find_nearby_providers_v3"/);
assert.match(app, /p_limit:DISCOVERY_FETCH_SIZE/);
assert.match(app, /p_offset:discoveryOffset/);
assert.match(app, /function appendLoadMoreControl\(\)/);
assert.match(app, /async function loadMoreProviders\(\)/);
assert.match(app, /new Set\(providers\.map\(provider=>String\(provider\.id\)\)\)/);
assert.match(app, /find_nearby_providers_v2/, "legacy RPC fallback must keep the frontend usable before v3 rollout");
assert.match(app, /p_sort:sortMode/);
assert.match(app, /discoveryOffset<5000/);
assert.ok(loadScenario.includes("/rest/v1/rpc/find_nearby_providers_v3"));
assert.match(loadScenario, /p_limit: 25/);
assert.match(loadScenario, /p_sort: "closest"/);

// Cache-bust the updated runtime so existing PWA installs can load pagination.
assert.ok(html.includes('/Doodhwala/app.js?v=20261027.1'));
assert.ok(sw.includes('const CACHE="doodhwala-v109"'));
assert.ok(sw.includes('/Doodhwala/app.js?v=20261027.1'));
assert.ok(sqlWorkflow.includes("20261026140000_doodhwala_paginated_provider_discovery.sql"));
assert.ok(staticWorkflow.includes("scripts/test-discovery-pagination.mjs"));
assert.match(assertions, /find_nearby_providers_v3\(null, null, 20, 'rating', 1, 0\)/);

console.log("PASS: bounded provider discovery pagination, stable sort order, compatibility fallback and PWA cache contracts.");
