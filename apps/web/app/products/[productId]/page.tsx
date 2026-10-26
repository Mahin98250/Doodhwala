import type { Metadata } from "next";
import PublicCatalogueDetail from "@/components/public-catalogue-detail";

export const metadata: Metadata = {
  title: "Milk product details | Doodhwala",
  description: "Review listed milk product details and the local seller's public information.",
  robots: { index: false, follow: true },
};

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ productId: string }>;
  searchParams: Promise<{ provider?: string | string[] }>;
}) {
  const [routeParams, query] = await Promise.all([params, searchParams]);
  const providerId = Array.isArray(query.provider)
    ? query.provider[0] ?? ""
    : query.provider ?? "";

  return <PublicCatalogueDetail providerId={providerId} productId={routeParams.productId} />;
}
