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

async function checkRedirect(path, expectedLocation) {
  const response = await fetch(new URL(path, baseUrl), { redirect: "manual" });
  assert.ok([307, 308].includes(response.status), `${path} should redirect to a clean framework route`);
  const location = response.headers.get("location");
  assert.ok(location, `${path} should return a redirect location`);
  const actual = new URL(location, baseUrl);
  const expected = new URL(expectedLocation, baseUrl);
  assert.equal(actual.pathname + actual.search, expected.pathname + expected.search, `${path} should redirect to ${expectedLocation}`);
  console.log(`✓ redirect ${path} → ${actual.pathname + actual.search}`);
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
  await checkRedirect("/?view=saved", "/saved");
  await checkRedirect("/?view=providers", "/providers");
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
  await checkRedirect("/Doodhwala/index.html", "/");
  await checkRedirect("/Doodhwala/checkout.html", "/checkout");
  await checkRedirect("/Doodhwala/orders.html", "/orders");
  await checkRedirect("/Doodhwala/plans.html", "/subscriptions");
  await checkRedirect("/Doodhwala/provider.html", "/seller");
  await checkRedirect("/Doodhwala/admin.html", "/owner");
  await checkRedirect("/Doodhwala/support.html", "/support");
  await checkRedirect("/Doodhwala/legal.html", "/legal");
  await checkRedirect("/Doodhwala/offline.html", "/offline");
  await checkRedirect("/Doodhwala/store.html?provider=" + providerId, "/store?provider=" + providerId);
  await checkRedirect("/Doodhwala/product.html?provider=" + providerId + "&product=" + productId, "/product?provider=" + providerId + "&product=" + productId);

  await checkPage("/store?provider=" + providerId, 200, "Loading live catalogue");
  await checkPage("/product?provider=" + providerId + "&product=" + productId, 200, "Loading live catalogue");
  await checkPage("/auth", 307);
  await checkRedirect("/index.html", "/");
  await checkRedirect("/auth.html", "/auth");
  await checkRedirect("/Doodhwala/auth.html", "/auth");
  await checkRedirect("/checkout.html", "/checkout");
  await checkRedirect("/orders.html", "/orders");
  await checkRedirect("/plans.html", "/subscriptions");
  await checkRedirect("/provider.html", "/seller");
  await checkRedirect("/admin.html", "/owner");
  await checkRedirect("/support.html", "/support");
  await checkRedirect("/store.html?provider=" + providerId, "/store?provider=" + providerId);
  await checkRedirect("/product.html?provider=" + providerId + "&product=" + productId, "/product?provider=" + providerId + "&product=" + productId);
  await checkPage("/plans", 307);
  await checkPage("/provider", 307);
  await checkPage("/admin", 307);
  await checkPage("/route-that-does-not-exist", 404, "This page isn’t in the catalogue");
  console.log("All Next.js route smoke checks passed.");
} finally {
  server.kill("SIGTERM");
}
