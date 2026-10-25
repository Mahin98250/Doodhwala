import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  async rewrites() {
    // Preserve old GitHub Pages paths while migrating the UI incrementally.
    // Query parameters (e.g. return, provider, product) are preserved.
    const beforeFiles = [
      { source: "/Doodhwala/", has: [{ type: "query" as const, key: "view", value: "saved" }], destination: "/saved" },
      { source: "/Doodhwala/", has: [{ type: "query" as const, key: "view", value: "providers" }], destination: "/providers" },
      { source: "/Doodhwala", has: [{ type: "query" as const, key: "view", value: "saved" }], destination: "/saved" },
      { source: "/Doodhwala", has: [{ type: "query" as const, key: "view", value: "providers" }], destination: "/providers" },
      { source: "/Doodhwala/index.html", has: [{ type: "query" as const, key: "view", value: "saved" }], destination: "/saved" },
      { source: "/Doodhwala/index.html", has: [{ type: "query" as const, key: "view", value: "providers" }], destination: "/providers" },
      { source: "/", has: [{ type: "query" as const, key: "view", value: "saved" }], destination: "/saved" },
      { source: "/", has: [{ type: "query" as const, key: "view", value: "providers" }], destination: "/providers" },
      { source: "/index.html", has: [{ type: "query" as const, key: "view", value: "saved" }], destination: "/saved" },
      { source: "/index.html", has: [{ type: "query" as const, key: "view", value: "providers" }], destination: "/providers" },
      { source: "/Doodhwala", destination: "/" },
      { source: "/Doodhwala/", destination: "/" },
      { source: "/Doodhwala/index.html", destination: "/" },
      { source: "/Doodhwala/auth.html", destination: "/auth" },
      { source: "/Doodhwala/checkout.html", destination: "/checkout" },
      { source: "/Doodhwala/orders.html", destination: "/orders" },
      { source: "/Doodhwala/plans.html", destination: "/subscriptions" },
      { source: "/Doodhwala/provider.html", destination: "/seller" },
      { source: "/Doodhwala/admin.html", destination: "/owner" },
      { source: "/Doodhwala/support.html", destination: "/support" },
      { source: "/Doodhwala/store.html", destination: "/store" },
      { source: "/Doodhwala/product.html", destination: "/product" },
      { source: "/Doodhwala/legal.html", destination: "/legal" },
      { source: "/Doodhwala/offline.html", destination: "/offline" },
      { source: "/index.html", destination: "/" },
      { source: "/auth.html", destination: "/auth" },
      { source: "/checkout.html", destination: "/checkout" },
      { source: "/orders.html", destination: "/orders" },
      { source: "/plans.html", destination: "/subscriptions" },
      { source: "/provider.html", destination: "/seller" },
      { source: "/admin.html", destination: "/owner" },
      { source: "/support.html", destination: "/support" },
      { source: "/store.html", destination: "/store" },
      { source: "/product.html", destination: "/product" },
      { source: "/legal.html", destination: "/legal" },
      { source: "/offline.html", destination: "/offline" },
    ];
    return { beforeFiles, afterFiles: [], fallback: [] };
  },
};

export default nextConfig;
