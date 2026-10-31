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


const app = read("app.js");
const checkoutPage = read("checkout/index.html");
assert.match(app, /let cartPersistenceAvailable=true;/, "cart must track whether it was safely persisted");
assert.match(app, /function saveCart\(\)[\s\S]*?cartPersistenceAvailable=persisted/, "cart writes must record persistence success or failure");
assert.match(app, /window\.addEventListener\("storage",event=>\{if\(event\.key!==\"doodhwala-cart\"&&event\.key!==null\)[\s\S]*?cart=next[\s\S]*?updateCart\(\)\}/, "cart contents and drawer must synchronize from cross-tab storage updates");
assert.match(app, /if\(!cartPersistenceAvailable&&!saveCart\(\)\)\{toast\([\s\S]*?return\}location\.href=\"\\/Doodhwala\\/checkout\\/\"/, "checkout must not navigate when the cart cannot be persisted");
assert.match(app, /function openCart\(\)\{updateCart\(\);document\.body\.classList\.add\("drawer-open"\)\}/, "opening the cart must refresh its rendered contents");
assert.ok(checkoutPage.includes('id="checkoutItems"') && checkoutPage.includes('src="/Doodhwala/checkout.js'), "the checkout route must load the checkout UI and controller");

console.log("Customer navigation, cart persistence and checkout entry contracts passed.");
