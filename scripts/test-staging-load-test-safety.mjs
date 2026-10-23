import assert from "node:assert/strict";
import fs from "node:fs";

const workflow = fs.readFileSync(".github/workflows/staging-scalability-load-test.yml", "utf8");
const scenario = fs.readFileSync("scripts/load-tests/nearby-provider-search.k6.js", "utf8");
const docs = fs.readFileSync("docs/scalability/STAGING_LOAD_TESTING.md", "utf8");

// The test must never run automatically from an arbitrary commit or pull request.
assert.match(workflow, /workflow_dispatch:/);
assert.doesNotMatch(workflow, /^\s*(?:push|pull_request|schedule):/m);

// Require explicit staging confirmation and reject the known production project.
assert.match(workflow, /RUN_CONFIRMATION/);
assert.match(workflow, /"STAGING"/);
assert.match(workflow, /STAGING_SUPABASE_URL/);
assert.match(workflow, /STAGING_SUPABASE_ANON_KEY/);
assert.match(workflow, /hmiboyfcvtfawrwujslg/);
assert.match(workflow, /https:/);
assert.match(workflow, /endsWith\("\.supabase\.co"\)/);

// Bound the initial load and keep the workload read-only at the RPC/business level.
assert.match(scenario, /\[1, 5, 10, 25, 50\]/);
assert.match(scenario, /\[30, 60, 120\]/);
assert.match(scenario, /rest\/v1\/rpc\/find_nearby_providers_v2/);
assert.doesNotMatch(scenario, /create_order|insert into|update public\.|delete from/i);
assert.match(scenario, /http_req_failed:\s*\["rate<0\.01"\]/);
assert.match(scenario, /p\(95\)<1500/);
assert.match(docs, /not a 100,000-concurrent-query test/i);
assert.match(docs, /Never test with customer data copied from production/i);

console.log("PASS: staging load test is manual-only, production-blocked, read-only, and bounded.");
