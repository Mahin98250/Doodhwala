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
const ns=html.indexOf('<nav class="provider-mobile-nav">');
const ne=html.indexOf("</nav>",ns);
assert.ok(ns>=0&&ne>ns,"mobile navigation must exist");
const nav=html.slice(ns,ne);
assert.match(nav,/aria-label="[^"]+"/,"mobile navigation must have an accessible name");
const buttons=[...nav.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)];
assert.equal(buttons.length,7,"keep all seven existing destinations available");
for(const [,attrs,body] of buttons){
 assert.match(attrs,/data-view="[^"]+"/,"destination must declare its view");
 assert.match(body,/<small>[^<]+<\/small>/,"destination must have a visible label");
 assert.match(body,/<svg[^>]*aria-hidden="true"/,"decorative icons must be hidden from assistive tech");
}
assert.match(css,/\.provider-mobile-nav button\.active\{[^}]*color:var\(--green\)[^}]*font-weight:800/,"active destination must remain visually distinct");
console.log("Provider mobile navigation accessibility contracts passed.");
