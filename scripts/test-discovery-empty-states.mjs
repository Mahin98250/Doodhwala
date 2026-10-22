import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

// A failed backend request must be presented honestly and provide a retry,
// rather than silently falling back to invented/demo seller inventory.
assert.match(app, /dataState\s*===\s*"error"/, "discovery must handle backend failure explicitly");
assert.match(app, /We could not load the marketplace\./, "backend failure must be clearly explained");
assert.match(app, /will not show fake provider data/, "backend failure must not imply demo sellers are real");
assert.match(app, /id="retryProviders"/, "backend failure must offer a retry");
assert.match(app, /retryProviders[^\n]*loadRemoteProvidersFromSaved/, "retry must reload from the saved delivery location");

// Empty discovery states must distinguish a search/filter miss from a location
// with no deliverable sellers. Both cases need an actionable recovery path.
assert.match(app, /No matching providers/, "search/filter misses need a dedicated empty state");
assert.match(app, /id="clearDiscoverySearch"/, "search misses must offer a clear-search action");
assert.match(app, /id="clearDiscoveryFilter"/, "filter misses must offer a show-all action");
assert.match(app, /No providers serve this location yet\./, "location-based unavailability must be stated honestly");
assert.match(app, /Try another location or change your delivery area\./, "location empty state must explain how to recover");
assert.match(app, /id="setLocationInline"/, "location empty state must offer a location action");
assert.match(app, /setLocationInline[^\n]*DoodhwalaLocation\?\.open/, "location action must open the location picker");

// Sellers outside the chosen delivery zone may be discoverable for transparency,
// but ordering actions must remain disabled for those providers.
assert.match(app, /p\.isServiceable===false\?'Outside zone'/, "outside-zone sellers must be visibly labelled");
assert.match(app, /p\.isServiceable!==false\?'<button class="add"/, "outside-zone sellers must not expose Add to cart");
assert.match(app, /if\(!p\|\|!m\|\|p\.isServiceable===false\)return/, "cart logic must reject outside-zone items");

console.log("Customer discovery empty-state contracts passed: honest outages, recoverable search/filter misses, location changes, and delivery-zone guardrails.");
