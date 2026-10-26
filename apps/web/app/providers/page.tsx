import type { Metadata } from "next";
import ProviderDiscovery from "@/components/provider-discovery";

export const metadata: Metadata = {
  title: "Find local milk providers | Doodhwala",
  description: "Discover independent milk sellers, compare listed milk prices, and check nearby delivery availability.",
  alternates: { canonical: "/providers" },
};

export default function ProvidersPage() {
  return <ProviderDiscovery />;
}
