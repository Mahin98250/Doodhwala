import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const authJs = fs.readFileSync(new URL("../auth.js", import.meta.url), "utf8");
const authHtml = fs.readFileSync(new URL("../auth.html", import.meta.url), "utf8");

const originDeclaration = authJs.match(/const PRODUCTION_ORIGIN="[^"]+";/)?.[0];
const routeFunction = authJs.match(/function getReturnPath\(\)\{[^\n]*\}/)?.[0];
assert.ok(originDeclaration, "auth.js must declare the production base URL");
assert.ok(routeFunction, "auth.js must define a return-path validator");

function resolveReturnPath(search) {
  return vm.runInNewContext(
    originDeclaration + "\n" + routeFunction + "\ngetReturnPath()",
    { location: { search }, URL, URLSearchParams }
  );
}

assert.equal(
  resolveReturnPath("?return=%2FDoodhwala%2Forders%2F%3Fview%3Dactive"),
  "/Doodhwala/orders/?view=active",
  "valid same-site paths must preserve their intended destination and query"
);
assert.equal(
  resolveReturnPath("?return=./provider/"),
  "/Doodhwala/provider/",
  "relative provider return paths must resolve inside the GitHub Pages project"
);
assert.equal(
  resolveReturnPath("?return=https%3A%2F%2Fevil.example%2Fcollect"),
  "/Doodhwala/",
  "external return destinations must be rejected"
);
assert.equal(
  resolveReturnPath("?return=%2FDoodhwala%2F..%2Fadmin.html"),
  "/Doodhwala/",
  "encoded traversal outside the project base must be rejected"
);
assert.equal(
  resolveReturnPath("?return=%2FDoodhwala%2Fauth%2F"),
  "/Doodhwala/",
  "auth must not redirect back to itself"
);
assert.equal(resolveReturnPath(""), "/Doodhwala/", "missing return paths must use a safe default");

assert.ok(authHtml.includes('id="passwordResetForm"'), "auth page must provide a password-reset form");
assert.ok(authHtml.includes('id="newPassword"') && authHtml.includes('id="confirmPassword"'), "password reset must confirm the new password");
assert.ok(authJs.includes('get("reset")==="1"'), "auth must recognize Supabase recovery redirects");
assert.ok(authJs.includes('auth.updateUser({password:nextPassword})'), "auth must save the new password through Supabase");
assert.ok(authJs.includes('if(new URLSearchParams(location.search).get("reset")==="1")return;'), "existing-session redirect must not bypass password recovery");

console.log("Auth regression checks passed: safe return destinations, external redirect rejection, and password recovery completion contracts.");
