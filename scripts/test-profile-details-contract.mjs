import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const read = (path) => fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");
const profile = read("profile/index.html");
const editor = read("profile/details/index.html");
const runtime = read("profile-details.js");
const nav = read("customer-nav.js");
const about = read("about/index.html");
const legal = read("legal.html");
const migrations = fs.readdirSync(new URL("../supabase/migrations/", import.meta.url));
const completionMigration = read("supabase/migrations/20261011151730_fix_customer_profile_phone_regex.sql");
const completionBase = read("supabase/migrations/20261008031000_customer_oauth_profile_completion.sql");

// Profile entry must point to a real dedicated editor, not route users back to auth.
assert.match(profile, /href=["']\/Doodhwala\/profile\/details\/["'][^>]*>[\s\S]*?Personal details/i,
  "Personal details must open the dedicated editor route");
assert.match(editor, /<form[^>]+id=["']personalDetailsForm["']/i, "Editor must expose a real personal details form");
assert.match(editor, /profile-details\.js\?v=20261029\.2/, "Editor must load the separately syntax-checked runtime");
for (const id of ["fullName", "phone", "addressLine", "areaName", "city", "pinCode", "saveProfile", "formMessage"]) {
  assert.ok(editor.includes('id="' + id + '"'), "Editor is missing required control: " + id);
}
assert.ok(nav.includes('pathname.startsWith("/doodhwala/profile/")||pathname==="/doodhwala/profile"'), "Nested Profile routes must keep Profile selected in bottom navigation");
assert.ok(profile.includes('href="/Doodhwala/about/"'), "Profile must expose the existing About destination");
assert.ok(about.includes("<title>About Doodhwala</title>"), "About destination must have a clear page title");
assert.ok(about.includes('href="/Doodhwala/profile/"'), "About page must provide a back-to-Profile route");
const deletionHelp = profile.match(/<a class="profile-link" href="\/Doodhwala\/support\/">[\s\S]*?<b>Account deletion help<\/b>[\s\S]*?<\/a>/);
assert.ok(deletionHelp, "Account deletion help must route to the existing Support destination rather than loop through Profile sign-in");
assert.match(deletionHelp[0], /this link does not delete your account/i, "Account deletion help must not imply that clicking submits or performs deletion");
for (const target of ["privacy", "terms", "seller", "cancellations", "grievance"]) {
  assert.ok(legal.includes('id="' + target + '"'), "Legal destination fragment must exist: #" + target);
  assert.ok(profile.includes('/Doodhwala/legal/#' + target), "Profile must expose legal destination fragment: #" + target);
}
assert.ok(profile.includes('href="/Doodhwala/support/"'), "Profile must expose Help & Support");
assert.ok(profile.includes('href="/Doodhwala/notifications/"'), "Profile must expose Notifications");
assert.ok(profile.includes('href="/Doodhwala/orders/"'), "Profile must expose Orders");
assert.ok(profile.includes('href="/Doodhwala/plans/"'), "Profile must expose Milk plans");
assert.ok(profile.includes('href="/Doodhwala/?view=saved"'), "Profile must expose Saved providers");
assert.match(runtime, /auth\.getSession\(\)/, "Editor must require an authenticated session");
assert.match(runtime, /setProfileFieldsEnabled\(false\)/, "Profile fields must be locked while initial data is loading or unavailable");
assert.match(runtime, /setProfileFieldsEnabled\(true\)/, "Profile fields must unlock only after the saved details load successfully");
assert.match(runtime, /Your saved details are loaded\. Make your changes, then save\.","info"/, "A successful read must be announced as information, not as a save-success confirmation");
assert.match(editor, /id="retryLoadDetails"[^>]*hidden/, "Profile editor must start with its load-retry control hidden");
assert.match(runtime, /retryLoad\.hidden=false/, "Profile read failures must expose a retry action");
assert.match(runtime, /retryLoad\.addEventListener\("click"/, "Retry must re-run the profile read flow");
assert.ok(runtime.includes("auth.onAuthStateChange("), "Editor must respond to cross-tab and same-tab authentication changes");
assert.ok(runtime.includes("latestAuthTransition.userId!==(currentUser?.id||null)"), "Editor must reject a stale session snapshot when authentication changes during loading");
assert.ok(runtime.includes("latestUser.id!==currentUser.id"), "Save must verify the active account immediately before the profile RPC");
assert.ok(runtime.includes("redirectingToSignIn"), "Auth changes must lock editing and clear stale form values before redirecting");
assert.match(runtime, /\.from\(["']profiles["']\)[\s\S]*?\.eq\(["']id["'],\s*currentUser\.id\)/,
  "Profile read must be scoped to the authenticated user's id");
assert.match(runtime, /\.from\(["']addresses["']\)[\s\S]*?\.eq\(["']user_id["'],\s*currentUser\.id\)[\s\S]*?\.eq\(["']is_default["'],\s*true\)/,
  "Default address read must be scoped to the authenticated user");
assert.match(runtime, /\.rpc\(["']complete_current_customer_profile["']/,
  "Saving must use the existing authenticated profile RPC");
assert.doesNotMatch(runtime, /\.from\(["']profiles["']\)\s*\.upsert|\.from\(["']profiles["']\)\s*\.update/,
  "Editor must not bypass the existing profile RPC with direct profile writes");
assert.match(completionMigration, /grant execute on function private\.complete_current_customer_profile_impl[\s\S]*?to authenticated/i,
  "Existing profile completion implementation must remain restricted to authenticated users");
assert.match(completionBase, /revoke execute on function public\.complete_current_customer_profile[\s\S]*?from public,anon/i,
  "Profile RPC must remain unavailable to anonymous/public callers");
assert.match(runtime, /textContent\s*=|\.value\s*=/, "User-controlled values should be assigned as text/input values, not HTML markup");
assert.match(runtime, /p_full_name|p_phone/, "Editor must send validated profile fields to the RPC");
assert.match(runtime, /p_address_line|p_area_name|p_city|p_pin_code/, "Editor must handle optional complete default-address fields");
assert.match(editor, /\.details-toggle-row input:focus-visible/, "Address edit checkbox must have visible keyboard focus");
assert.match(editor, /pwa-register\.js/, "Editor must register the existing PWA service worker");
assert.match(editor, /resilience\.js/, "Editor must load the existing network resilience bootstrap");
assert.ok(migrations.includes("20261011151730_fix_customer_profile_phone_regex.sql"),
  "Editor must rely on the known PostgreSQL-safe phone validation migration");
const worker = read("sw.js");
assert.match(worker, /doodhwala-v112/, "Service worker cache revision must advance for the new editor");
assert.match(worker, /profile\/details\/index\.html/, "Service worker must precache the editor route");
assert.match(worker, /profile-details\.js\?v=20261029\.2/, "Service worker must precache the editor runtime");

console.log("Personal details contracts passed: dedicated route, authenticated session, owner-scoped reads, protected RPC, validation feedback, and PWA/resilience bootstraps.");


// Exercise the actual UI state transitions with a mocked read-only client. This
// deliberately never calls the profile RPC or touches a database.
{
  const elements = new Map();
  const ids = ["personalDetailsForm","saveProfile","formMessage","retryLoadDetails","editAddress","addressFields","fullName","phone","addressLine","areaName","city","pinCode","accountEmail"];
  for (const id of ids) elements.set(id, {
    id, value:"", disabled:false, hidden:id==="retryLoadDetails", checked:false,
    required:false, textContent:"", dataset:{}, listeners:{},
    addEventListener(type, callback){this.listeners[type]=callback;},
    focus(){this.focused=true;}
  });
  let profileReads=0;
  let rpcCalls=0;
  const user={id:"customer-a",email:"customer@example.test",user_metadata:{}};
  const supabase={
    auth:{
      async getSession(){return {data:{session:{user}},error:null};},
      onAuthStateChange(callback){this.callback=callback;}
    },
    from(table){
      const query={
        select(){return this;},eq(){return this;},order(){return this;},limit(){return this;},
        async maybeSingle(){
          if(table==="profiles"){
            profileReads++;
            if(profileReads===1)return {data:null,error:new Error("temporary network failure")};
            return {data:{full_name:"Customer Example",phone:"9876543210"},error:null};
          }
          return {data:null,error:null};
        }
      };
      return query;
    },
    async rpc(){rpcCalls++;return {error:null};}
  };
  const window={Doodhwala:{supabase}};
  const document={getElementById(id){return elements.get(id)||null;}};
  const location={pathname:"/Doodhwala/profile/details/",search:"",hash:"",replace(){throw new Error("unexpected sign-in redirect");}};
  vm.runInNewContext(runtime,{window,document,location,console:{warn(){},error(){}}});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(elements.get("formMessage").dataset.kind,"error","failed initial profile read must announce an error");
  assert.equal(elements.get("retryLoadDetails").hidden,false,"failed initial profile read must expose retry");
  assert.equal(elements.get("saveProfile").disabled,true,"save must remain disabled after failed initial read");
  assert.equal(elements.get("fullName").disabled,true,"profile fields must remain locked after failed initial read");
  assert.equal(elements.get("editAddress").disabled,true,"address editing must remain locked after failed initial read");
  elements.get("retryLoadDetails").listeners.click();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(profileReads,2,"retry must repeat the profile read");
  assert.equal(elements.get("retryLoadDetails").hidden,true,"retry control must hide after successful load");
  assert.equal(elements.get("saveProfile").disabled,false,"save must unlock after successful initial load");
  assert.equal(elements.get("fullName").disabled,false,"profile fields must unlock after successful initial load");
  assert.equal(elements.get("fullName").value,"Customer Example","retry must populate the saved profile");
  assert.equal(elements.get("formMessage").dataset.kind,"info","a successful read must not claim a save succeeded");
  assert.equal(rpcCalls,0,"the UI-state regression must not exercise or alter RPC persistence");
}


// The unavailable-client branch must also lock the form and recover when the
// client becomes available; this remains a UI-only test with mocked reads.
{
  const elements = new Map();
  for (const id of ["personalDetailsForm","saveProfile","formMessage","retryLoadDetails","editAddress","addressFields","fullName","phone","addressLine","areaName","city","pinCode","accountEmail"]) {
    elements.set(id,{id,value:"",disabled:false,hidden:id==="retryLoadDetails",checked:false,required:false,textContent:"",dataset:{},listeners:{},addEventListener(type,callback){this.listeners[type]=callback;},focus(){}});
  }
  const window={Doodhwala:{}};
  const document={getElementById(id){return elements.get(id)||null;}};
  const location={pathname:"/Doodhwala/profile/details/",search:"",hash:"",replace(){throw new Error("unexpected sign-in redirect");}};
  vm.runInNewContext(runtime,{window,document,location,console:{warn(){},error(){}}});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(elements.get("retryLoadDetails").hidden,false,"unavailable client must expose retry");
  assert.equal(elements.get("fullName").disabled,true,"unavailable client must keep fields locked");
  assert.equal(elements.get("saveProfile").disabled,true,"unavailable client must keep save disabled");
  const user={id:"customer-b",email:"customer-b@example.test",user_metadata:{}};
  window.Doodhwala.supabase={
    auth:{async getSession(){return {data:{session:{user}},error:null};},onAuthStateChange(){}},
    from(table){return {select(){return this;},eq(){return this;},order(){return this;},limit(){return this;},async maybeSingle(){return {data:table==="profiles"?{full_name:"Second Customer",phone:"9876543211"}:null,error:null};}};},
    async rpc(){throw new Error("UI state test must not call RPC");}
  };
  elements.get("retryLoadDetails").listeners.click();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(elements.get("retryLoadDetails").hidden,true,"retry should hide after the client becomes available");
  assert.equal(elements.get("fullName").disabled,false,"fields should unlock after a successful retry");
  assert.equal(elements.get("fullName").value,"Second Customer","successful retry should load the account's saved name");
  assert.equal(elements.get("formMessage").dataset.kind,"info","successful retry should not announce a save");
}
