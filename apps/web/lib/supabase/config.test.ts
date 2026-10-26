import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSupabaseUrl } from "./config.ts";

test("normalizes a hosted Supabase URL", () => {
  assert.equal(normalizeSupabaseUrl(" https://project.supabase.co/ "), "https://project.supabase.co");
});

test("allows local HTTP development", () => {
  assert.equal(normalizeSupabaseUrl("http://localhost:54321/"), "http://localhost:54321");
  assert.equal(normalizeSupabaseUrl("http://127.0.0.1:54321"), "http://127.0.0.1:54321");
});

test("rejects insecure non-local URLs", () => {
  assert.equal(normalizeSupabaseUrl("http://project.supabase.co"), null);
  assert.equal(normalizeSupabaseUrl("ftp://project.supabase.co"), null);
});

test("rejects missing, malformed, credentialed, query, and fragment URLs", () => {
  assert.equal(normalizeSupabaseUrl(""), null);
  assert.equal(normalizeSupabaseUrl("   "), null);
  assert.equal(normalizeSupabaseUrl("not a URL"), null);
  assert.equal(normalizeSupabaseUrl("https://user:pass@project.supabase.co"), null);
  assert.equal(normalizeSupabaseUrl("https://project.supabase.co?token=secret"), null);
  assert.equal(normalizeSupabaseUrl("https://project.supabase.co#fragment"), null);
});
