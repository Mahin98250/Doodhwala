import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const plans = read("plans.js");
const html = read("plans.html");
const sw = read("sw.js");

function between(startMarker, endMarker) {
  const start = plans.indexOf(startMarker);
  const end = plans.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0 && end > start, "Could not isolate " + startMarker);
  return plans.slice(start, end).trim();
}

const localDate = between("function localDateIso(", "\nfunction tomorrow()");
const addDays = between("function addDays(", "\nfunction selectedDays()");
const selectedDays = between("function selectedDays(){", "\nfunction deliveryCount()");
const deliveryCount = between("function deliveryCount(){", "\nfunction renderSchedulePreview()");
const preview = between("function renderSchedulePreview(){", "\nfunction updatePreview()");
assert.match(addDays, /return localDateIso\(d\)/, "Date-only plan arithmetic must preserve the local calendar date.");
assert.doesNotMatch(addDays, /toISOString/, "Date-only arithmetic must not round-trip through UTC.");
assert.ok(html.includes('subscription-schedule-preview.css?v=20261027.2'), "Plan page must load the current preview stylesheet.");
assert.ok(html.includes('plans.js?v=20261027.3'), "Plan page must load the current schedule runtime.");
assert.ok(sw.includes('const CACHE="doodhwala-v98"'), "PWA cache must be bumped with the subscription calendar release.");
assert.ok(sw.includes('/Doodhwala/plans.js?v=20261027.3'), "The current plan runtime must be precached.");
assert.ok(sw.includes('/Doodhwala/subscription-schedule-preview.css?v=20261027.2'), "The calendar styles must be precached.");

const base = [
  "const $=id=>document.getElementById(id);",
  localDate,
  addDays,
  selectedDays,
  deliveryCount,
  preview
].join("\n");

const elements = {
  planStart: { value: "2026-10-26" },
  planEnd: { value: "2026-11-01" },
  planQuantity: { value: "1" },
  schedulePreviewDays: { innerHTML: "" },
  schedulePreviewHint: { textContent: "" },
  schedulePreviewCount: { textContent: "" }
};
const buttons = [1, 3, 5, 7].map(day => ({ dataset: { day: String(day) }, classList: { contains: () => true } }));
const document = {
  getElementById(id) { return elements[id] || null; },
  querySelectorAll(selector) { return selector === ".day-button.active" ? buttons : []; }
};
const env = {
  document,
  product: { price_per_litre: 60 },
  dayNames: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  esc: v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c])),
  money: v => "₹" + Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 }),
  Intl,
  Date
};
const counted = runInNewContext(base + "\n({ count: deliveryCount(), nextDay: addDays('2026-10-31',1) })", env);
assert.equal(counted.count, 4, "A Monday-to-Sunday window should count only the four selected weekdays.");
assert.equal(counted.nextDay, "2026-11-01", "Month-end plan dates must advance by a local calendar day.");

const activeButtons = [{ dataset: { day: "1" } }, { dataset: { day: "3" } }];
const previewEnv = {
  ...env,
  activeButtons,
  document: {
    getElementById(id) { return elements[id] || null; },
    querySelectorAll(selector) { return selector === ".day-button.active" ? activeButtons : []; }
  }
};
elements.planEnd.value = "2026-10-28";
const previewResult = runInNewContext(
  base + "\nrenderSchedulePreview(); const first={count:document.getElementById('schedulePreviewCount').textContent,hint:document.getElementById('schedulePreviewHint').textContent,html:document.getElementById('schedulePreviewDays').innerHTML}; document.getElementById('planEnd').value='2026-10-25'; renderSchedulePreview(); const invalid={count:document.getElementById('schedulePreviewCount').textContent,hint:document.getElementById('schedulePreviewHint').textContent,html:document.getElementById('schedulePreviewDays').innerHTML}; document.getElementById('planEnd').value='2026-10-31'; activeButtons.splice(1,1); renderSchedulePreview(); ({first,invalid,single:{count:document.getElementById('schedulePreviewCount').textContent,hint:document.getElementById('schedulePreviewHint').textContent}})",
  previewEnv
);
assert.equal(previewResult.first.count, "2 deliveries", "The first-week preview must count its selected weekdays inside the plan range.");
assert.match(previewResult.first.hint, /₹120 estimated value/, "The preview total must use quantity and locked product price.");
assert.equal((previewResult.first.html.match(/class="schedule-preview-day/g) || []).length, 7, "The preview must show seven calendar dates.");
assert.match(previewResult.first.html, /Milk delivery · 1 L/, "Selected weekdays must be labelled as delivery days.");
assert.match(previewResult.first.html, /Plan ended/, "Dates after the plan end must be clearly labelled.");
assert.equal(previewResult.invalid.count, "Dates needed", "An invalid date range must not advertise deliveries.");
assert.equal(previewResult.invalid.html, "", "An invalid date range must clear the previous preview.");
assert.match(previewResult.invalid.hint, /Choose a valid start and end date/, "An invalid date range must explain what to fix.");
assert.equal(previewResult.single.count, "1 delivery", "A single scheduled day must use correct singular wording.");
assert.match(previewResult.single.hint, /1 planned delivery,/, "The first-week description must use valid singular wording.");

console.log("PASS: subscription schedule count, month-end dates, seven-day preview, end-date guard, estimate and PWA precache contracts.");
