// Read-only, on-demand production preflight for Doodhwala.
// Does not create orders, modify database rows, or send customer-facing diagnostics.
import { readFileSync } from "node:fs";

const config = readFileSync(new URL("../supabase-config.js", import.meta.url), "utf8");
const projectUrl = config.match(/DOODHWALA_SUPABASE_URL\s*=\s*["']([^"']+)["']/)?.[1]?.replace(/\/+$/, "");
const publishableKey = config.match(/DOODHWALA_SUPABASE_PUBLISHABLE_KEY\s*=\s*["']([^"']+)["']/)?.[1];

if (!projectUrl || !publishableKey) {
  throw new Error("Production preflight could not read the public Supabase configuration.");
}

const results = [];
const timeoutMs = 12_000;
const headers = { apikey: publishableKey, accept: "application/json" };

function result(status, label, detail) {
  results.push({ status, label, detail });
}

async function request(url, options = {}) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
}

async function readResponse(response) {
  const text = await response.text();
  try { return { text, body: JSON.parse(text) }; }
  catch { return { text, body: null }; }
}

async function checkSite() {
  const url = "https://mahin98250.github.io/Doodhwala/";
  const response = await request(url, { headers: { accept: "text/html" } });
  const body = await response.text();
  if (!response.ok || !/<title>\s*Doodhwala/i.test(body) || !body.includes("checkout.html")) {
    result("FAIL", "GitHub Pages app", "The homepage did not return the expected Doodhwala application shell.");
    return;
  }
  result("PASS", "GitHub Pages app", "Homepage returned HTTP " + response.status + " with the Doodhwala shell.");
}

async function checkAuthApi() {
  const response = await request(projectUrl + "/auth/v1/settings", { headers });
  const data = await readResponse(response);
  if (!response.ok || !data.body || typeof data.body !== "object") {
    result("FAIL", "Supabase Auth API", "Settings endpoint returned HTTP " + response.status + ".");
    return;
  }
  result("PASS", "Supabase Auth API", "Settings endpoint is reachable (HTTP " + response.status + ").");
  result("MANUAL", "Leaked-password protection", "This public endpoint is not treated as proof of the compromised-password control. Confirm the Auth security setting and rerun Supabase security advisors.");
}

async function checkProtectedRpc(name, args) {
  let response;
  let data;
  try {
    response = await request(projectUrl + "/rest/v1/rpc/" + name, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify(args)
    });
    data = await readResponse(response);
  } catch (error) {
    result("FAIL", name + " RPC", "Request failed: " + String(error?.message || error));
    return;
  }

  const code = String(data.body?.code || "");
  const message = String(data.body?.message || data.body?.error || data.text || "");
  if (code === "PGRST202" || code === "PGRST203" || /function .* not found|could not find the function/i.test(message)) {
    result("FAIL", name + " RPC", "The required RPC is missing from the live API schema (HTTP " + response.status + ").");
    return;
  }
  if (response.status >= 500) {
    result("FAIL", name + " RPC", "The endpoint returned HTTP " + response.status + ".");
    return;
  }
  if ((response.status === 401 || response.status === 403) &&
      (/42501/.test(code) || /permission denied|not allowed|unauthorized/i.test(message))) {
    result("PASS", name + " RPC", "The live API recognizes the function and blocks anonymous execution.");
    return;
  }
  if (/authentication_required/.test(message)) {
    result("PASS", name + " RPC", "The function exists and rejects an unauthenticated caller.");
    return;
  }
  if (response.ok) {
    result("FAIL", name + " RPC", "The protected function unexpectedly accepted an unauthenticated request.");
    return;
  }
  result("FAIL", name + " RPC", "Could not verify its presence and protected access (HTTP " + response.status + ").");
}

async function checkEdgeFunction(slug, expectedHealthyStatus = null) {
  let response;
  let data;
  try {
    response = await request(projectUrl + "/functions/v1/" + slug, { headers });
    data = await readResponse(response);
  } catch (error) {
    result("FAIL", slug + " Edge Function", "Request failed: " + String(error?.message || error));
    return;
  }
  const message = String(data.body?.message || data.body?.error || data.text || "");
  if (response.status === 404 && /not found|not deployed|function/i.test(message)) {
    result("FAIL", slug + " Edge Function", "The deployed endpoint returned HTTP 404; the function may be missing.");
    return;
  }
  if (response.status >= 500) {
    result("FAIL", slug + " Edge Function", "The endpoint returned HTTP " + response.status + ".");
    return;
  }
  if (expectedHealthyStatus !== null && response.status !== expectedHealthyStatus) {
    result("FAIL", slug + " Edge Function", "Expected HTTP " + expectedHealthyStatus + " for this unsupported GET probe, received HTTP " + response.status + ".");
    return;
  }
  result("PASS", slug + " Edge Function", "Endpoint responds with HTTP " + response.status + ". This only verifies reachability, not business correctness.");
}

await Promise.all([
  checkSite().catch(error => result("FAIL", "GitHub Pages app", String(error?.message || error))),
  checkAuthApi().catch(error => result("FAIL", "Supabase Auth API", String(error?.message || error))),
  checkProtectedRpc("customer_order_payment_controls_ready", {}),
  checkProtectedRpc("customer_set_order_payment_method", {
    p_order_id: "00000000-0000-4000-8000-000000000001",
    p_method: "cod"
  }),
  checkEdgeFunction("client-error-report"),
  checkEdgeFunction("doodhwala-pay")
]);

for (const item of results) {
  const icon = item.status === "PASS" ? "PASS" : item.status === "MANUAL" ? "MANUAL" : "BLOCK";
  console.log("[" + icon + "] " + item.label + ": " + item.detail);
}

const blockers = results.filter(item => item.status === "FAIL");
console.log("");
console.log("Summary: " + results.filter(item => item.status === "PASS").length + " passed, " +
  blockers.length + " blocked, " + results.filter(item => item.status === "MANUAL").length + " manual verification required.");
console.log("Safety boundary: this probe performs only HTTP GETs and unauthenticated RPC attempts. It does not create orders or mutate customer data.");
console.log("A passing probe is not a penetration test, legal review, PSP certification, or proof of bank settlement.");

if (blockers.length) {
  console.error("Production preflight is BLOCKED until all critical endpoint/schema checks pass.");
  process.exitCode = 1;
}
