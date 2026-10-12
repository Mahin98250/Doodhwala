import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const errors=[];
const staticFiles=fs.readdirSync(root,{withFileTypes:true})
  .filter(entry=>entry.isFile()&&(/\.html$/i.test(entry.name)||/\.js$/i.test(entry.name)||/\.webmanifest$/i.test(entry.name)))
  .map(entry=>entry.name);

const secretPatterns=[
  ["Supabase secret API key",/sb_secret_[A-Za-z0-9_-]{16,}/i],
  ["service-role key assignment",/SUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*["'][^"'\s]{12,}["']/i],
  ["secret-key map assignment",/SUPABASE_SECRET_KEYS\s*[:=]\s*["'][^"'\s]{12,}["']/i],
  ["JWT-like credential",/eyJ[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}/],
  ["private key material",/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/]
];
for(const file of staticFiles){
  const content=fs.readFileSync(path.join(root,file),"utf8");
  for(const [label,pattern] of secretPatterns){
    if(pattern.test(content))errors.push(file+" -> possible "+label+" found in a browser-served file");
  }
}

const configPath=path.join(root,"supabase-config.js");
const config=fs.readFileSync(configPath,"utf8");
const key=config.match(/DOODHWALA_SUPABASE_PUBLISHABLE_KEY\s*=\s*["']([^"']+)["']/);
assert.ok(key,"browser config must define a publishable Supabase key");
assert.match(key[1],/^sb_publishable_[A-Za-z0-9_-]{20,}$/,"browser config must use a publishable key, never a secret/service-role key");

const migrationsDir=path.join(root,"supabase/migrations");
const migrationName=fs.readdirSync(migrationsDir).find(name=>/^\d+_doodhwala_security_least_privilege\.sql$/.test(name));
assert.ok(migrationName,"least-privilege security migration must be committed");
const sql=fs.readFileSync(path.join(migrationsDir,migrationName),"utf8");
for(const required of [
  "revoke truncate, references, trigger",
  "on all tables in schema public",
  "alter default privileges for role postgres",
  "revoke all on tables from public, anon, authenticated",
  "revoke all on sequences from public, anon, authenticated",
  "revoke execute on functions from public, anon, authenticated",
  "private.ensure_customer_loyalty(uuid)",
  "private.create_order_secure_with_promo(uuid, uuid, jsonb, text, text, text)",
  "private.protect_profile_account_type()",
  "profiles_protect_account_type",
  "set search_path = %L"
]){
  assert.ok(sql.toLowerCase().includes(required.toLowerCase()),"security migration must include "+required);
}
assert.ok(sql.includes("grant execute on function private.create_order_secure_with_promo"),"order-with-promo RPC must remain available to authenticated customers");
assert.ok(sql.includes("grant execute on function private.provider_add_tracking_event_impl"),"provider live tracking must remain available to authenticated providers");
assert.ok(sql.includes("grant execute on function private.submit_order_rating_impl"),"customer rating must remain available to authenticated customers");
assert.ok(sql.includes("from public, anon, authenticated, service_role"),"internal helper/trigger function execution must be revoked from client roles");

const followupName=fs.readdirSync(migrationsDir).find(name=>/^\\d+_doodhwala_security_default_privileges\\.sql$/.test(name));
assert.ok(followupName,"schema-specific default privilege correction must be committed");
const defaultsSql=fs.readFileSync(path.join(migrationsDir,followupName),"utf8").toLowerCase();
for(const required of [
  "alter default privileges for role postgres in schema public",
  "revoke all on tables from public, anon, authenticated",
  "revoke all on sequences from public, anon, authenticated",
  "revoke execute on functions from public, anon, authenticated"
]) assert.ok(defaultsSql.includes(required),"default-privilege correction must include "+required);

if(errors.length){
  console.error("Security contract validation failed:\n - "+errors.join("\n - "));
  process.exit(1);
}
console.log("Security contract checks passed: browser key type, no obvious secret credentials in static assets, least-privilege database defaults, helper grants, and SECURITY DEFINER search_path hardening.");
