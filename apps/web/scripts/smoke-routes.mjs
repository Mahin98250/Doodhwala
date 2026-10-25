import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { resolve } from "node:path";

const port = Number(process.env.SMOKE_PORT || 3177);
const baseUrl = `http://127.0.0.1:${port}`;
const nextCli = resolve("node_modules/next/dist/bin/next");
const server = spawn(process.execPath, [nextCli, "start", "--hostname", "127.0.0.1", "--port", String(port)], {
  cwd: process.cwd(),
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
  stdio: "ignore",
});

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`Next.js server exited early with code ${server.exitCode}`);
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {
      // The server is still starting.
    }
    await delay(500);
  }
  throw new Error("Next.js server did not become ready within 20 seconds.");
}

async function checkPage(path, expectedStatus, expectedText) {
  const response = await fetch(new URL(path, baseUrl), { redirect: "manual" });
  assert.equal(response.status, expectedStatus, `${path} should return HTTP ${expectedStatus}`);
  const body = await response.text();
  if (expectedText) assert.ok(body.includes(expectedText), `${path} should include expected page text: ${expectedText}`);
  console.log(`✓ ${expectedStatus} ${path}`);
}

try {
  await waitForServer();
  await checkPage("/", 200, "Your neighbourhood");
  await checkPage("/providers", 200, "Find milk close to home");
  await checkPage("/stores/00000000-0000-4000-8000-000000000001", 200, "Loading live catalogue");
  await checkPage("/products/00000000-0000-4000-8000-000000000002?provider=00000000-0000-4000-8000-000000000001", 200, "Loading live catalogue");
  await checkPage("/route-that-does-not-exist", 404, "This page isn’t in the catalogue");
  console.log("All Next.js route smoke checks passed.");
} finally {
  server.kill("SIGTERM");
}
