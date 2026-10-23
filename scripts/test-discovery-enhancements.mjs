import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const sw = fs.readFileSync(new URL("../sw.js", import.meta.url), "utf8");

assert.match(app, /let onlyServiceable=false/, "delivery-only state must default off");
assert.match(app, /if\(!readLocation\(\)\)[\s\S]*?Choose a delivery location first/, "delivery filtering must prompt for a location first");
assert.match(app, /const deliveryOk=!onlyServiceable\|\|p\.isServiceable===true/, "delivery-only filtering must include only providers marked serviceable by the backend");
assert.match(html, /id="deliverableOnly"/, "delivery-only toggle must be present");
assert.match(app, /id="clearDeliveryFilter"/, "empty delivery-only results must offer a clear action");

assert.match(app, /if\(comparedProviderIds\.length>=3\)/, "comparison must cap selection at three sellers");
assert.match(app, /function selectedForComparison\(\)/, "comparison selection must be centrally derived");
assert.match(app, /function compareCellProvider\(p\)/, "comparison rows must use an explicit public-field projection");
assert.match(app, /escapeHtml\(p\.name\|\|"Local seller"\)/, "seller display names must be escaped before HTML insertion");
assert.match(app, /Delivery availability/, "comparison must show delivery availability");
assert.match(app, /Milk & price/, "comparison must show milk prices");
assert.match(app, /data-compare-store=/, "comparison must link to each seller store");
assert.match(html, /id="compareDialog"/, "accessible comparison dialog must exist");
assert.match(html, /aria-modal="true"/, "comparison dialog must declare modal semantics");
assert.match(html, /id="closeCompare"/, "comparison dialog must have a close control");
assert.match(css, /\.compare-dock\[hidden\],\.compare-overlay\[hidden\]\{display:none!important\}/, "hidden comparison UI must not occupy layout");
assert.match(css, /@media\(max-width:760px\)[\s\S]*?\.compare-overlay\{align-items:end/, "comparison dialog must adapt to mobile");
assert.match(sw, /const CACHE="doodhwala-v90"/, "PWA cache revision must advance for the discovery UI");
assert.ok(sw.includes('/Doodhwala/styles.css?v=20261023.5'), "PWA must precache the current stylesheet");
assert.ok(sw.includes('/Doodhwala/assets/mascot.png'), "PWA must precache the final mascot logo");
assert.ok(sw.includes('/Doodhwala/app.js?v=20261022.4'), "PWA must precache the current runtime");
assert.ok(html.includes('/Doodhwala/styles.css?v=20261023.5'), "homepage must request the current stylesheet");
assert.ok(html.includes('/Doodhwala/app.js?v=20261022.4'), "homepage must request the current app version");

console.log("Customer discovery enhancements passed: delivery-only filter, escaped seller comparison, responsive modal, and PWA cache contracts.");

assert.match(app, /event\.key!=="Tab"/, "comparison dialog must manage keyboard tab focus");
assert.match(app, /document\.activeElement===first/, "comparison dialog must keep keyboard focus inside the overlay");
assert.match(css, /body\.compare-open\{overflow:hidden/, "background scrolling must be locked while the comparison sheet is open");

assert.match(app, /const unitPrice=Number\(p\.productPrices\?\.\[index\]\)/, "cart must use validated numeric product price");
assert.match(app, /unitPrice<=0/, "cart must reject missing, invalid, or zero milk prices");
assert.match(app, /Price unavailable/, "invalid catalogue prices must not be shown as ₹0");
assert.match(app, /Number\(p\.productPrices\[i\]\)>0/, "Add button must be hidden for invalid prices");

const resilience = fs.readFileSync(new URL("../resilience.js", import.meta.url), "utf8");
assert.match(resilience, /event\.lineno/, "runtime error reports should include source line numbers when available");
assert.match(resilience, /event\.colno/, "runtime error reports should include source column numbers when available");
