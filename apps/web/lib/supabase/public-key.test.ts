import assert from "node:assert/strict";
import test from "node:test";
import { isPublicSupabaseKey } from "./public-key.ts";

function legacyJwt(role: string): string {
  const payload = Buffer.from(JSON.stringify({ role, iss: "supabase" })).toString("base64url");
  return "header." + payload + ".signature";
}

test("accepts a Supabase publishable key", () => {
  assert.equal(isPublicSupabaseKey("sb_publishable_example"), true);
});

test("rejects a Supabase secret key", () => {
  assert.equal(isPublicSupabaseKey("sb_secret_example"), false);
});

test("accepts a legacy anon JWT and rejects a legacy service-role JWT", () => {
  assert.equal(isPublicSupabaseKey(legacyJwt("anon")), true);
  assert.equal(isPublicSupabaseKey(legacyJwt("service_role")), false);
});

test("rejects blank, malformed and unknown key formats", () => {
  assert.equal(isPublicSupabaseKey(""), false);
  assert.equal(isPublicSupabaseKey("   "), false);
  assert.equal(isPublicSupabaseKey("not-a-supabase-key"), false);
  assert.equal(isPublicSupabaseKey("a.b.c"), false);
});
