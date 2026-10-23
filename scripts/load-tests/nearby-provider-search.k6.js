import http from "k6/http";
import { check } from "k6";

const baseUrl = String(__ENV.STAGING_SUPABASE_URL || "").replace(/\/+$/, "");
const apiKey = String(__ENV.STAGING_SUPABASE_ANON_KEY || "");
const targetRate = Number(__ENV.TARGET_RPS || 5);
const durationSeconds = Number(__ENV.DURATION_SECONDS || 30);
const latitude = Number(__ENV.TEST_LATITUDE || 23.0225);
const longitude = Number(__ENV.TEST_LONGITUDE || 72.5714);

if (!baseUrl) throw new Error("STAGING_SUPABASE_URL is required.");
if (!apiKey) throw new Error("STAGING_SUPABASE_ANON_KEY is required.");
if (!Number.isInteger(targetRate) || ![1, 5, 10, 25, 50].includes(targetRate)) {
  throw new Error("TARGET_RPS must be one of 1, 5, 10, 25, or 50.");
}
if (!Number.isInteger(durationSeconds) || ![30, 60, 120].includes(durationSeconds)) {
  throw new Error("DURATION_SECONDS must be 30, 60, or 120.");
}
if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
  throw new Error("TEST_LATITUDE must be between -90 and 90.");
}
if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
  throw new Error("TEST_LONGITUDE must be between -180 and 180.");
}

export const options = {
  scenarios: {
    nearby_provider_search: {
      executor: "constant-arrival-rate",
      rate: targetRate,
      timeUnit: "1s",
      duration: durationSeconds + "s",
      preAllocatedVUs: Math.min(10, Math.max(2, targetRate)),
      maxVUs: Math.min(100, Math.max(10, targetRate * 2)),
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    checks: ["rate>0.99"],
    http_req_duration: ["p(95)<1500"],
  },
};

export default function () {
  const response = http.post(
    baseUrl + "/rest/v1/rpc/find_nearby_providers_v2",
    JSON.stringify({
      p_latitude: latitude,
      p_longitude: longitude,
      p_max_km: 20,
    }),
    {
      headers: {
        apikey: apiKey,
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      tags: { endpoint: "find_nearby_providers_v2", workload: "read_only" },
      timeout: "10s",
    },
  );

  let isJsonArray = false;
  if (response.status === 200) {
    try {
      isJsonArray = Array.isArray(response.json());
    } catch (_) {
      isJsonArray = false;
    }
  }

  check(response, {
    "nearby RPC returns HTTP 200": r => r.status === 200,
    "nearby RPC returns a JSON array": () => isJsonArray,
  });
}
