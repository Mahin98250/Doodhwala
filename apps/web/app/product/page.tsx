import PublicCatalogueDetail from "@/components/public-catalogue-detail";
import WorkspaceFrame from "@/components/workspace-frame";

export const metadata = { title: "Milk product details | Doodhwala", robots: { index: false, follow: true } };

export default async function LegacyProductAlias({ searchParams }: { searchParams: Promise<{ provider?: string | string[]; product?: string | string[] }> }) {
  const query = await searchParams;
  const providerId = Array.isArray(query.provider) ? query.provider[0] ?? "" : query.provider ?? "";
  const productId = Array.isArray(query.product) ? query.product[0] ?? "" : query.product ?? "";
  if (!providerId || !productId) return <WorkspaceFrame title="Milk product" description="Open a product from a local seller catalogue."><section className="workspace-card workspace-empty"><p>The provider and product IDs are required.</p><a className="workspace-button workspace-button-primary" href="/providers">Find providers</a></section></WorkspaceFrame>;
  return <PublicCatalogueDetail providerId={providerId} productId={productId} />;
}
