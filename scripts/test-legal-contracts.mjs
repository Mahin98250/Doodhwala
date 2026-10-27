import assert from "node:assert/strict";
import fs from "node:fs";

const legal = fs.readFileSync(new URL("../legal.html", import.meta.url), "utf8");
const pages = ["index.html","auth.html","checkout.html","orders.html","plans.html","provider.html","admin.html","store.html","product.html","support.html"];
assert.match(legal, /Draft for legal review/i, "legal page must remain visibly marked as a draft");
assert.match(legal, /not a final or effective policy/i, "draft must not imply the policies are already final");
for (const section of ["id=" + '"privacy"', "id=" + '"terms"', "id=" + '"cancellations"', "id=" + '"seller"', "id=" + '"grievance"', "id=" + '"data-rights"', "id=" + '"security"']) {
  assert.ok(legal.includes(section), "legal center must include " + section);
}
assert.match(legal, /Support contact: not yet available/i, "must not invent a support contact");
assert.match(legal, /exact legal entity or individual operator/i, "must flag operator legal identity as unconfirmed");
assert.match(legal, /No specific refund promise/i, "must not invent refund promises");
assert.match(legal, /Nothing in this draft is intended to remove rights that consumers have/i, "must preserve applicable consumer rights");
assert.match(legal, /not enabled and that no payment is collected/i, "payment disclosure must match the current checkout");
assert.match(legal, /must be reviewed by a qualified Indian legal professional/i, "legal review must be required before launch");
for (const file of pages) {
  const html = fs.readFileSync(new URL("../" + file, import.meta.url), "utf8");
  assert.ok(html.includes("/Doodhwala/legal/#privacy"), file + " must link to privacy information");
  assert.ok(html.includes("/Doodhwala/legal/#terms"), file + " must link to marketplace terms");
  assert.ok(html.includes("Legal pages are drafts pending review"), file + " must clearly disclose draft status");
  const stylesheetVersion = ["index.html","support.html"].includes(file) ? (file === "index.html" ? "styles.css?v=20261023.5" : "styles.css?v=20261023.5") : "styles.css?v=20261023.5";
  assert.ok(html.includes(stylesheetVersion), file + " must use current shared legal-footer styles");
}
const sw = fs.readFileSync(new URL("../sw.js", import.meta.url), "utf8");
assert.ok(sw.includes('const CACHE="doodhwala-v100"'), "PWA cache revision must advance for discovery, legal content, and customer UI fixes");
assert.ok(sw.includes('"/Doodhwala/legal.html"'), "legal center must be precached");
assert.ok(sw.includes('"/Doodhwala/styles.css?v=20261023.5"'), "current shared stylesheet must be precached");
console.log("Legal policy draft checks passed: draft warnings, all core policy sections, truthful missing-contact/refund disclosures, site navigation and PWA precache.");
