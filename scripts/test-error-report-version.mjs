import assert from "node:assert/strict";
import fs from "node:fs";

const edge = fs.readFileSync(new URL("../supabase/functions/client-error-report/index.ts", import.meta.url), "utf8");
const client = fs.readFileSync(new URL("../resilience.js", import.meta.url), "utf8");

assert.match(client, /const APP_VERSION = "20261025\.1"/, "client reporter must advertise the current app version");
assert.match(client, /app_version: APP_VERSION/, "each error report payload must include the app version");
assert.match(edge, /const LEGACY_APP_VERSION = "20261011\.1"/, "server must keep a fallback for older deployed clients");
assert.match(edge, /const APP_VERSION_PATTERN = \/\^\\d\{8\}\\\.\\d\{1,3\}\$\//, "server must validate the version format before storing it");
assert.match(edge, /const suppliedAppVersion = String\(input\.app_version \|\| ""\)/, "edge function must read the client-supplied version");
assert.match(edge, /const clientAppVersion = APP_VERSION_PATTERN\.test\(suppliedAppVersion\) \? suppliedAppVersion : LEGACY_APP_VERSION/, "invalid or missing versions must use the legacy fallback");
assert.match(edge, /app_version: clientAppVersion/, "stored report must preserve the validated originating client version");
assert.match(edge, /\| app: " \+ row\.app_version \+ /, "diagnostic alert text must include the originating client version");

console.log("Error-report version contracts passed: client tagging, safe validation, backward-compatible fallback and alert context.");
