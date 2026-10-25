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
  assert.equal(response.headers.get("x-content-type-options"), "nosniff", `${path} should disable MIME sniffing`);
  assert.equal(response.headers.get("x-frame-options"), "DENY", `${path} should prevent framing`);
  assert.equal(response.headers.get("referrer-policy"), "strict-origin-when-cross-origin", `${path} should limit referrer data`);
  assert.equal(response.headers.get("permissions-policy"), "camera=(), microphone=(), geolocation=(self)", `${path} should limit browser permissions while allowing same-origin location`);
  const body = await response.text();
  if (expectedText) assert.ok(body.includes(expectedText), `${path} should include expected page text: ${expectedText}`);
  console.log(`✓ ${expectedStatus} ${path}`);
}

try {
  await waitForServer();
  const providerId = "00000000-0000-4000-8000-000000000001";
  const productId = "00000000-0000-4000-8000-000000000002";
  const subscriptionId = "00000000-0000-4000-8000-000000000003";
  const orderId = "00000000-0000-4000-8000-000000000004";

  await checkPage("/", 200, "Your neighbourhood");
  await checkPage("/providers", 200, "Find milk close to home");
  await checkPage("/saved", 200, "Your saved items");
  await checkPage("/?view=saved", 200, "Your saved items");
  await checkPage("/?view=providers", 200, "Find milk close to home");
  await checkPage("/stores/" + providerId, 200, "Loading live catalogue");
  await checkPage("/products/" + productId + "?provider=" + providerId, 200, "Loading live catalogue");

  await checkPage("/auth/sign-in", 200, "Welcome back");
  await checkPage("/auth/sign-up", 200, "Create your account");
  await checkPage("/auth/reset-password", 200, "Reset your password");
  await checkPage("/account", 200, "Sign in to continue");
  await checkPage("/cart", 200, "Your cart");
  await checkPage("/checkout", 200, "Secure checkout");
  await checkPage("/orders", 200, "Your orders");
  await checkPage("/orders/" + orderId, 200, "Order details");
  await checkPage("/subscriptions", 200, "Milk subscriptions");
  await checkPage("/subscriptions/" + subscriptionId, 200, "Subscription details");
  await checkPage("/seller", 200, "Seller workspace");
  await checkPage("/seller/products", 200, "Seller workspace");
  await checkPage("/seller/deliveries", 200, "Seller workspace");
  await checkPage("/owner", 200, "Owner control");
  await checkPage("/support", 200, "Customer support");
  await checkPage("/legal", 200, "Marketplace information");
  await checkPage("/offline", 200, "You may be offline");
  await checkPage("/Doodhwala/index.html", 200, "Your neighbourhood");
  await checkPage("/Doodhwala/checkout.html", 200, "Secure checkout");
  await checkPage("/Doodhwala/orders.html", 200, "Your orders");
  await checkPage("/Doodhwala/plans.html", 200, "Milk subscriptions");
  await checkPage("/Doodhwala/provider.html", 200, "Seller workspace");
  await checkPage("/Doodhwala/admin.html", 200, "Owner control");
  await checkPage("/Doodhwala/support.html", 200, "Customer support");
  await checkPage("/Doodhwala/legal.html", 200, "Marketplace information");
  await checkPage("/Doodhwala/offline.html", 200, "You may be offline");
  await checkPage("/Doodhwala/store.html?provider=" + providerId, 200, "Loading live catalogue");
  await checkPage("/Doodhwala/product.html?provider=" + providerId + "&product=" + productId, 200, "Loading live catalogue");

  await checkPage("/store?provider=" + providerId, 200, "Loading live catalogue");
  await checkPage("/product?provider=" + providerId + "&product=" + productId, 200, "Loading live catalogue");
  await checkPage("/auth", 307);
  await checkPage("/auth.html", 307);
  await checkPage("/Doodhwala/auth.html", 307);
  await checkPage("/plans", 307);
  await checkPage("/provider", 307);
  await checkPage("/admin", 307);
  await checkPage("/route-that-does-not-exist", 404, "This page isn’t in the catalogue");
  console.log("All Next.js route smoke checks passed.");
} finally {
  server.kill("SIGTERM");
}
