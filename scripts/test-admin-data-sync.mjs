import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source=fs.readFileSync(new URL("../admin.js",import.meta.url),"utf8");
const start=source.indexOf("function adminRealtimeCacheKeys(table){");
assert.notEqual(start,-1,"admin realtime table-to-cache mapping must exist");
const open=source.indexOf("{",start);
let depth=0,end=-1;
for(let i=open;i<source.length;i++){
  if(source[i]==="{")depth++;
  else if(source[i]==="}"){
    depth--;
    if(depth===0){end=i+1;break}
  }
}
assert.notEqual(end,-1,"admin realtime mapping function must be balanced");
const functionSource=source.slice(start,end)+"\nthis.adminRealtimeCacheKeys=adminRealtimeCacheKeys;";
const context=vm.createContext({});
vm.runInContext(functionSource,context);

const cases={
  orders:["orders","customers"],
  provider_profiles:["providers","products","orders"],
  provider_verifications:["providers","products"],
  profiles:["customers","orders","subscriptions"],
  milk_subscriptions:["subscriptions","customers"],
  subscription_deliveries:["subscriptions","customers"],
  milk_products:["products","providers"],
  provider_service_areas:["providers"]
};
for(const [table,expected] of Object.entries(cases)){
  assert.deepEqual(Array.from(context.adminRealtimeCacheKeys(table)),expected,table+" must invalidate all dependent admin index data");
}
assert.deepEqual(Array.from(context.adminRealtimeCacheKeys("unknown_table")),[]);

for(const table of Object.keys(cases)){
  assert.ok(source.includes('table:"'+table+'"'),"admin realtime channel must listen for "+table);
}
assert.ok(source.includes("refreshAdminIndex(indexKeys)"),"realtime refresh must reload affected cached indexes");
assert.ok(source.includes("refreshAdminSearch()"),"realtime refresh must redraw active global search results");
assert.ok(source.includes("const keys=Object.keys(ADMIN_INDEX_JOBS)"),"foreground return must refresh the global admin index");
const migrationPath="supabase/migrations/20261012082403_doodhwala_admin_realtime_data_sync.sql";
const migration=fs.readFileSync(new URL("../"+migrationPath,import.meta.url),"utf8");
for(const table of ["profiles","milk_products","provider_service_areas"]){
  assert.ok(migration.includes("'"+table+"'"),"migration must publish "+table+" for Realtime");
}
assert.ok(migration.includes("private.is_current_user_admin()"),"Realtime SELECT policies must be limited to allowlisted admins");
assert.ok(source.includes("let overview=null,section=\"overview\",cache={},searchTerm=\"\",currentDetail=null"),"admin details must be tracked for safe refreshes");
assert.ok(source.includes("async function refreshCurrentAdminDetail()"),"open detail view must refresh in place");
assert.ok(source.includes("const ADMIN_FALLBACK_INTERVAL_MS=60000"),"admin needs a bounded fallback refresh when realtime events are missed");
assert.ok(source.includes("window.__adminSyncFallbackTimer"),"visible admin fallback timer must be installed");
console.log("Admin data-sync checks passed: invalidation dependencies, realtime publication migration, detail preservation, global search and foreground/fallback recovery.");
