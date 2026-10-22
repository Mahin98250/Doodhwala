import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../pwa-register.js", import.meta.url), "utf8");
const calls = [];
const reports = [];
const warnings = [];
const failure = new Error("simulated scope/install rejection");
failure.name = "SecurityError";
const window = {
  navigator: {
    serviceWorker: {
      register(path, options) {
        calls.push({ path, options });
        return Promise.reject(failure);
      }
    }
  },
  console: { warn(...args) { warnings.push(args); } },
  DoodhwalaResilience: { report(...args) { reports.push(args); } },
  addEventListener() {}
};
const document = { readyState: "complete", addEventListener() {} };
vm.runInNewContext(source, { window, document, Promise, String });
await new Promise(resolve => setImmediate(resolve));

assert.equal(calls.length, 1, "PWA registration should be attempted once on a complete document");
assert.equal(calls[0].path, "/Dudh-Wallah/sw.js", "registration must use the GitHub Pages project path");
assert.equal(calls[0].options.scope, "/Dudh-Wallah/", "registration must stay within the project scope");
assert.equal(reports.length, 1, "registration failure should be sent to the resilience reporter");
assert.match(reports[0][2], /SecurityError: simulated scope\/install rejection/, "registration report must preserve safe error details");
assert.ok(warnings.length > 0, "registration failure must still be visible in the browser console");

console.log("PWA registration diagnostics passed: project scope and useful registration error details.");
