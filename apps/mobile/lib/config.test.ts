import test from "node:test";
import assert from "node:assert/strict";
import { getSupabasePublicConfig, normalizeSupabasePublicKey, normalizeSupabaseUrl } from "./config.ts";

test("accepts hosted HTTPS project URLs and normalizes trailing slash", () => {
  assert.equal(normalizeSupabaseUrl(" https://example.supabase.co/ "), "https://example.supabase.co");
});
test("allows HTTP only for local development", () => {
  assert.equal(normalizeSupabaseUrl("http://localhost:54321"), "http://localhost:54321");
  assert.equal(normalizeSupabaseUrl("http://example.supabase.co"), null);
});
test("rejects credentials, query strings, fragments and invalid URLs", () => {
  assert.equal(normalizeSupabaseUrl("https://user:pass@example.supabase.co"), null);
  assert.equal(normalizeSupabaseUrl("https://example.supabase.co?debug=1"), null);
  assert.equal(normalizeSupabaseUrl("https://example.supabase.co/#frag"), null);
  assert.equal(normalizeSupabaseUrl("not-a-url"), null);
});
test("accepts public key formats and rejects obvious secret-key formats", () => {
  assert.equal(normalizeSupabasePublicKey("sb_publishable_example"), "sb_publishable_example");
  assert.equal(normalizeSupabasePublicKey("sb_secret_example"), null);
  assert.equal(normalizeSupabasePublicKey("service_role_example"), null);
  assert.equal(normalizeSupabasePublicKey("short"), null);
});
test("requires both a valid URL and public key", () => {
  assert.deepEqual(getSupabasePublicConfig("https://example.supabase.co", "sb_publishable_example"), {
    url: "https://example.supabase.co",
    anonKey: "sb_publishable_example",
  });
  assert.equal(getSupabasePublicConfig("http://example.supabase.co", "sb_publishable_example"), null);
  assert.equal(getSupabasePublicConfig("https://example.supabase.co", "sb_secret_example"), null);
});
