import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const plans = fs.readFileSync(new URL("../plans.js", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../plans.html", import.meta.url), "utf8");
const localDateHelper = plans.match(/function localIsoDateForPlans\(date=new Date\(\)\)\{[^\n]+\}/)?.[0];
const tomorrowHelper = plans.match(/function tomorrow\(date=new Date\(\)\)\{[^\n]+\}/)?.[0];
const addDaysHelper = plans.match(/function addDays\(s,n\)\{[^\n]+\}/)?.[0];

assert.ok(localDateHelper, "subscription dates must use a local calendar formatter");
assert.ok(tomorrowHelper, "tomorrow must be based on local calendar date, not UTC ISO slicing");
assert.ok(addDaysHelper, "subscription end date must use local calendar arithmetic");
assert.match(plans, /delivery_skip_cutoff_passed:"The skip deadline for this delivery has passed/i, "skip cutoff errors need a clear customer-facing explanation");
assert.match(plans, /\$\("planStart"\)\.min=localIsoDateForPlans\(\)/i, "start date must not allow past dates");
assert.match(html, /plans\.js\?v=20261027\.1/i, "updated plan client must have a cache-busted version");

const executable = [
  localDateHelper,
  tomorrowHelper,
  addDaysHelper,
  'const now = new Date("2026-10-27T01:00:00+05:30");',
  'if (localIsoDateForPlans(now) !== "2026-10-27") throw new Error("local date shifted");',
  'if (tomorrow(now) !== "2026-10-28") throw new Error("tomorrow crossed UTC boundary incorrectly");',
  'if (addDays("2026-10-28", 29) !== "2026-11-26") throw new Error("plan end date arithmetic incorrect");',
  'console.log("Asia/Kolkata subscription date boundary tests passed");'
].join("\n");

execFileSync(process.execPath, ["-e", executable], {
  env: { ...process.env, TZ: "Asia/Kolkata" },
  stdio: "inherit"
});
console.log("Subscription cutoff/date UI contracts passed.");
