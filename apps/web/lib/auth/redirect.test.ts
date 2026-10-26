import test from "node:test";
import assert from "node:assert/strict";
import { getSafeReturnPath } from "./redirect.ts";

const origin = "https://preview.doodhwala.example";

test("allows an internal path with query and fragment", () => {
  assert.equal(getSafeReturnPath("/orders/abc?tab=details#latest", origin), "/orders/abc?tab=details#latest");
});

test("defaults missing and root paths safely", () => {
  assert.equal(getSafeReturnPath(null, origin), "/");
  assert.equal(getSafeReturnPath("/", origin), "/");
});

test("rejects absolute, protocol-relative and malformed redirects", () => {
  assert.equal(getSafeReturnPath("https://attacker.example/phish", origin), "/");
  assert.equal(getSafeReturnPath("//attacker.example/phish", origin), "/");
  assert.equal(getSafeReturnPath("/\\\\attacker.example/phish", origin), "/");
  assert.equal(getSafeReturnPath("/bad\u0000path", origin), "/");
});

test("does not permit a changed origin after URL resolution", () => {
  assert.equal(getSafeReturnPath("///attacker.example", origin), "/");
  assert.equal(getSafeReturnPath("javascript:alert(1)", origin), "/");
});
