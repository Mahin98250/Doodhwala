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
  async redirects() {
    // Legacy entry points permanently move users to framework-native routes.
    // Specific query-driven legacy views must come first so they win over the
    // generic compatibility redirects below. Unmatched query parameters carry
    // through to the destination.
    const legacyRoutes = [
      { source: "/Doodhwala/", has: [{ type: "query" as const, key: "view", value: "saved" }], destination: "/saved", permanent: false },
      { source: "/Doodhwala/", has: [{ type: "query" as const, key: "view", value: "providers" }], destination: "/providers", permanent: false },
      { source: "/Doodhwala", has: [{ type: "query" as const, key: "view", value: "saved" }], destination: "/saved", permanent: false },
      { source: "/Doodhwala", has: [{ type: "query" as const, key: "view", value: "providers" }], destination: "/providers", permanent: false },
      { source: "/Doodhwala/index.html", has: [{ type: "query" as const, key: "view", value: "saved" }], destination: "/saved", permanent: false },
      { source: "/Doodhwala/index.html", has: [{ type: "query" as const, key: "view", value: "providers" }], destination: "/providers", permanent: false },
      { source: "/", has: [{ type: "query" as const, key: "view", value: "saved" }], destination: "/saved", permanent: false },
      { source: "/", has: [{ type: "query" as const, key: "view", value: "providers" }], destination: "/providers", permanent: false },
      { source: "/index.html", has: [{ type: "query" as const, key: "view", value: "saved" }], destination: "/saved", permanent: false },
      { source: "/index.html", has: [{ type: "query" as const, key: "view", value: "providers" }], destination: "/providers", permanent: false },
      { source: "/Doodhwala", destination: "/", permanent: false },
      { source: "/Doodhwala/", destination: "/", permanent: false },
      { source: "/Doodhwala/index.html", destination: "/", permanent: false },
      { source: "/Doodhwala/auth.html", destination: "/auth", permanent: false },
      { source: "/Doodhwala/checkout.html", destination: "/checkout", permanent: false },
      { source: "/Doodhwala/orders.html", destination: "/orders", permanent: false },
      { source: "/Doodhwala/plans.html", destination: "/subscriptions", permanent: false },
      { source: "/Doodhwala/provider.html", destination: "/seller", permanent: false },
      { source: "/Doodhwala/admin.html", destination: "/owner", permanent: false },
      { source: "/Doodhwala/support.html", destination: "/support", permanent: false },
      { source: "/Doodhwala/store.html", destination: "/store", permanent: false },
      { source: "/Doodhwala/product.html", destination: "/product", permanent: false },
      { source: "/Doodhwala/legal.html", destination: "/legal", permanent: false },
      { source: "/Doodhwala/offline.html", destination: "/offline", permanent: false },
      { source: "/index.html", destination: "/", permanent: false },
      { source: "/auth.html", destination: "/auth", permanent: false },
      { source: "/checkout.html", destination: "/checkout", permanent: false },
      { source: "/orders.html", destination: "/orders", permanent: false },
      { source: "/plans.html", destination: "/subscriptions", permanent: false },
      { source: "/provider.html", destination: "/seller", permanent: false },
      { source: "/admin.html", destination: "/owner", permanent: false },
      { source: "/support.html", destination: "/support", permanent: false },
      { source: "/store.html", destination: "/store", permanent: false },
      { source: "/product.html", destination: "/product", permanent: false },
      { source: "/legal.html", destination: "/legal", permanent: false },
      { source: "/offline.html", destination: "/offline", permanent: false },
    ];
    return legacyRoutes;
  },
};
};

export default nextConfig;
