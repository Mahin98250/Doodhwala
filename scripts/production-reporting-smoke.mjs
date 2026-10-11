import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

const config = readFileSync("supabase-config.js", "utf8");
const projectUrl = config.match(/DOODHWALA_SUPABASE_URL\s*=\s*["']([^"']+)["']/)?.[1];
const publishableKey = config.match(/DOODHWALA_SUPABASE_PUBLISHABLE_KEY\s*=\s*["']([^"']+)["']/)?.[1];

if (!projectUrl || !publishableKey) {
  throw new Error("Production reporting smoke test could not read the public Supabase client configuration.");
}

const runId = randomUUID();
const fingerprint = createHash("sha256").update("doodhwala-production-reporting-smoke:" + runId).digest("hex").slice(0, 24);
const endpoint = projectUrl.replace(/\/+$/, "") + "/functions/v1/client-error-report";
const payload = {
  event_type: "manual_report",
  severity: "warning",
  fingerprint,
  message: "PRODUCTION REPORTING SMOKE TEST: synthetic diagnostic only; no customer order. Run " + runId,
  route: "/Dudh-Wallah/",
  resource: "github-actions-production-reporting-smoke",
  status_code: null
};

const response = await fetch(endpoint, {
  method: "POST",
  headers: {
    Origin: "https://mahin98250.github.io",
    "Content-Type": "application/json",
    apikey: publishableKey
  },
  body: JSON.stringify(payload),
  signal: AbortSignal.timeout(15000)
});

const responseText = await response.text();
let body;
try {
  body = JSON.parse(responseText);
} catch {
  throw new Error("Reporting endpoint returned non-JSON response (HTTP " + response.status + ").");
}

if (response.status !== 202 || body.ok !== true) {
  throw new Error("Production reporting smoke test failed: HTTP " + response.status + " " + JSON.stringify(body));
}

console.log(JSON.stringify({
  result: "PASS",
  endpoint: new URL(endpoint).origin + "/functions/v1/client-error-report",
  httpStatus: response.status,
  storedByEndpoint: true,
  severity: payload.severity,
  syntheticDiagnostic: true,
  customerOrdersCreated: 0,
  runId
}, null, 2));
