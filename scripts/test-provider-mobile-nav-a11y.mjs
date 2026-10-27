import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const js=read("provider.js"), html=read("provider.html"), css=read("provider.css");
const start=js.indexOf("function showView(view){");
const end=js.indexOf("\nasync function setupProviderSubscriptionRealtime",start);
assert.ok(start>=0&&end>start,"showView handler must exist");
const handler=js.slice(start,end);
assert.match(handler,/b\.closest\("\.provider-mobile-nav"\)/,"mobile nav state must be scoped to mobile navigation");
assert.match(handler,/setAttribute\("aria-current","page"\)/,"active destination must be announced");
assert.match(handler,/removeAttribute\("aria-current"\)/,"inactive destination must not remain current");
const ns=html.indexOf('<nav class="provider-mobile-nav" aria-label="Seller sections">');
const ne=html.indexOf("</nav>",ns);
assert.ok(ns>=0&&ne>ns,"mobile navigation must have an accessible name");
const nav=html.slice(ns,ne);
const buttons=[...nav.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)];
assert.equal(buttons.length,7,"keep all seven existing destinations available");
for(const [,attrs,body] of buttons){
 assert.match(attrs,/data-view="[^"]+"/,"destination must declare its view");
 assert.match(body,/<small>[^<]+<\/small>/,"destination must have a visible label");
 assert.match(body,/<svg[^>]*aria-hidden="true"/,"decorative icons must be hidden from assistive tech");
}
assert.match(css,/\.provider-mobile-nav button\.active\{[^}]*color:var\(--green\)[^}]*font-weight:800/,"active destination must remain visually distinct");

assert.match(css,/@media\\(max-width:760px\\)\\{[\\s\\S]*?\\.provider-top-actions \\.provider-auth-link\\{display:none\\}/,"mobile header should prioritize essential controls over the redundant account link");
assert.match(css,/\\.provider-top-actions \\.provider-store-toggle\\{padding:7px 8px;font-size:8px/,"store availability control must stay compact on mobile");
assert.match(css,/\\.provider-top-actions \\.provider-top-signout\\{padding:7px 8px;font-size:9px/,"sign-out must remain accessible in the mobile header");
assert.match(html,/provider\\.css\\?v=20261027\\.2/,"mobile CSS change must use a fresh cache-busting version");
assert.match(read("sw.js"),/const CACHE="doodhwala-v98"/,"service worker cache must be bumped for the mobile fix");
console.log("Provider mobile navigation and compact header accessibility contracts passed.");
