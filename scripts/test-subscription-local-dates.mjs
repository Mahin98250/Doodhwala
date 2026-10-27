import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const plans = fs.readFileSync(new URL("../plans.js", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../plans.html", import.meta.url), "utf8");
const localDateHelper = plans.match(/function localDateIso\(d=new Date\(\)\)\{[^\n]+\}/)?.[0];
const tomorrowHelper = plans.match(/function tomorrow\(date=new Date\(\)\)\{[^\n]+\}/)?.[0];
const addDaysHelper = plans.match(/function addDays\(s,n\)\{[^\n]+\}/)?.[0];

assert.ok(localDateHelper, "subscription dates must use the local calendar formatter");
assert.ok(tomorrowHelper, "tomorrow must use local calendar arithmetic and allow deterministic tests");
assert.ok(addDaysHelper, "subscription end date must use local calendar arithmetic");
assert.match(plans, /\$\("planStart"\)\.min=localDateIso\(\)/i, "start date must not allow past dates in the UI");
assert.match(plans, /delivery_skip_cutoff_passed:"The skip deadline for this delivery has passed/i, "skip cutoff errors need a clear customer-facing explanation");
assert.match(html, /plans\.js\?v=20261027\.3/i, "current plan runtime must remain cache-busted at the deployed version");

const executable = [
  localDateHelper,
  tomorrowHelper,
  addDaysHelper,
  'const now = new Date("2026-10-27T01:00:00+05:30");',
  'if (localDateIso(now) !== "2026-10-27") throw new Error("local date shifted");',
  'if (tomorrow(now) !== "2026-10-28") throw new Error("tomorrow crossed the UTC boundary incorrectly");',
  'if (addDays("2026-10-28", 29) !== "2026-11-26") throw new Error("plan end date arithmetic is incorrect");',
  'console.log("Asia/Kolkata subscription date boundary tests passed");'
].join("\n");

execFileSync(process.execPath, ["-e", executable], {
  env: { ...process.env, TZ: "Asia/Kolkata" },
  stdio: "inherit"
});
console.log("Subscription cutoff/date UI contracts passed.");
