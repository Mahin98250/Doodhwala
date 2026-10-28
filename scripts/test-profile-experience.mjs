import assert from "node:assert/strict";
import fs from "node:fs";
const read=path=>fs.readFileSync(new URL("../"+path,import.meta.url),"utf8");
const profile=read("profile.html"),clean=read("profile/index.html"),css=read("profile.css"),js=read("profile.js"),nav=read("customer-nav.js"),home=read("index.html"),app=read("app.js"),sw=read("sw.js");
for(const [name,html] of [["profile.html",profile],["profile/index.html",clean]]){
 assert.match(html,/<title>Profile — Doodhwala<\/title>/,name+" must identify the Profile screen");
 assert.match(html,/profile\.css\?v=20261029\.1/,name+" must load Profile styles");
 assert.match(html,/profile\.js\?v=20261029\.1/,name+" must load Profile behavior");
 assert.match(html,/customer-nav\.js/,name+" must use shared navigation");
 for(const id of ["privacy","terms","cancellations","seller","grievance","data-rights","security"])assert.ok(html.includes("/Doodhwala/legal/#"+id),name+" must link legal section "+id);
}
assert.match(nav,/profile:'<svg/,"mobile navigation must provide a Profile icon");
assert.match(nav,/item\("profile","Profile"\)/,"Profile must replace Saved in the six-slot mobile nav");
assert.match(nav,/if\(key==="profile"\)\{go\(BASE\+"profile\/"\);return\}/,"Profile navigation must use the clean route");
assert.match(nav,/doodhwala\/profile\//,"Profile route must be recognized");
assert.match(home,/data-go="profile"/,"desktop sidebar must expose Profile");
assert.match(home,/Profile &amp; policies/,"home footer must point to Profile instead of duplicating policies");
assert.match(app,/if\(destination==="profile"\)/,"desktop Profile navigation must work");
assert.match(css,/@media\(max-width:760px\)/,"Profile must have a dedicated mobile layout");
assert.match(css,/prefers-reduced-motion:reduce/,"Profile motion must respect accessibility preferences");
assert.match(css,/safe-area-inset-bottom/,"Profile must respect mobile safe-area insets");
assert.match(js,/auth\.getSession\(\)/,"Profile identity must come from the existing auth session");
assert.match(js,/signOut\(\{scope:"local"\}\)/,"Profile sign-out must be local-scope only");
assert.match(js,/textContent/,"Profile session content must use safe text rendering");
assert.match(sw,/const CACHE="doodhwala-v109"/,"Profile UI release must advance the PWA cache revision");
for(const asset of ["/Doodhwala/profile.html","/Doodhwala/profile/","/Doodhwala/profile.css?v=20261029.1","/Doodhwala/profile.js?v=20261029.1"])assert.ok(sw.includes(asset),"PWA must precache "+asset);
console.log("Profile experience contracts passed: clean/legacy routes, mobile navigation, session-safe account controls, legal links and offline assets.");
