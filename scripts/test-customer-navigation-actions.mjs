import assert from "node:assert/strict";
import fs from "node:fs";

const read = path => fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");
const nav = read("customer-nav.js");
const home = read("index.html");

const destinations = {
  home: ['if(key==="home")', 'window.scrollTo({top:0,behavior:"smooth"})'],
  explore: ['if(key==="explore")', 'BASE+"?view=providers"'],
  plans: ['if(key==="plans")', 'BASE+"plans/"'],
  orders: ['if(key==="orders")', 'BASE+"orders/"'],
  saved: ['if(key==="saved")', 'BASE+"?view=saved"'],
  cart: ['if(key==="cart")', 'BASE+"?cart=1"'],
  profile: ['if(key==="profile")', 'BASE+"profile/"']
};

for (const [key, markers] of Object.entries(destinations)) {
  assert.ok(nav.includes('item("' + key + '"'), "navigation must render " + key);
  for (const marker of markers) {
    assert.ok(nav.includes(marker), key + " must have an explicit destination/action: " + marker);
  }
}
assert.match(nav, /data-customer-nav[\s\S]*?addEventListener\("click"/, "navigation buttons must be wired to their destination handler");
assert.match(nav, /setActive\(nav\)/, "active navigation state must be refreshed when mounted");
assert.match(nav, /addEventListener\("popstate"/, "browser back/forward must refresh the active destination");
assert.match(nav, /addEventListener\("storage"/, "cart count must refresh when another tab changes local storage");
assert.match(nav, /doodhwala:cart-updated/, "cart count must refresh after in-app cart changes");
assert.ok(home.includes('data-filter="cow"') && home.includes('data-filter="buffalo"') && home.includes('data-filter="a2"'),
  "home quick filters must retain the core milk categories");
assert.ok(home.includes('id="search"') && home.includes('id="providerSort"') && home.includes('id="deliverableOnly"'),
  "home discovery controls must remain present");

const market = read("customer-market-10x.js");
assert.ok(market.includes('const BASE="/Doodhwala/";'), "customer dashboard must use the canonical GitHub Pages base path");
assert.ok(!market.includes('BASE+"/Doodhwala/'), "customer dashboard routes must not append the repository base path twice");
assert.ok(market.includes('BASE+"orders/"'), "customer order actions must resolve beneath the repository base path");

console.log("Customer navigation interaction contracts passed: all seven destinations, active state, history, cart sync and discovery controls.");
