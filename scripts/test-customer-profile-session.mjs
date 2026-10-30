import assert from "node:assert/strict";
import fs from "node:fs";

const read = path => fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");
const sdkTag = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.1/dist/umd/supabase.min.js";

for (const path of ["profile/index.html", "profile/details/index.html"]) {
  const html = read(path);
  const sdk = html.indexOf(sdkTag);
  const config = html.indexOf("supabase-config.js");
  const client = html.indexOf("supabase-client.js");
  assert.ok(sdk >= 0, path + " must load the Supabase browser SDK");
  assert.ok(config > sdk, path + " must load Supabase config after the SDK");
  assert.ok(client > config, path + " must create the Supabase client after the SDK and config");
}

const profile = read("profile/index.html");
assert.ok(profile.includes('id="accountSignOut"'), "Profile must expose a working sign-out control for signed-in users");
assert.match(profile, /auth\.onAuthStateChange\(/, "Profile account summary must react to sign-in and sign-out changes");
assert.match(profile, /signOut\(\{scope:\s*"local"\}\)/, "Profile sign-out must end only the current browser session");
assert.ok(profile.includes('action.href="/Doodhwala/profile/details/"'), "Manage account must open Personal details, not loop back to the auth page");
assert.match(profile, /signOut\.hidden=false/, "The sign-out control must appear for an authenticated account");
assert.match(profile, /signOut\.hidden=true/, "The sign-out control must be hidden while signed out");

console.log("Customer Profile session contracts passed: SDK bootstrap order, live account state, safe local sign-out, and correct Manage account destination.");
