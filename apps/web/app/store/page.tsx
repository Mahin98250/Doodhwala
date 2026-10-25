import PublicCatalogueDetail from "@/components/public-catalogue-detail";
import WorkspaceFrame from "@/components/workspace-frame";

export const metadata = { title: "Local seller catalogue | Doodhwala", robots: { index: false, follow: true } };

export default async function LegacyStoreAlias({ searchParams }: { searchParams: Promise<{ provider?: string | string[] }> }) {
  const query = await searchParams;
  const providerId = Array.isArray(query.provider) ? query.provider[0] ?? "" : query.provider ?? "";
  if (!providerId) return <WorkspaceFrame title="Seller catalogue" description="Open a seller from the live provider discovery page."><section className="workspace-card workspace-empty"><p>A provider ID is required to open a specific catalogue.</p><a className="workspace-button workspace-button-primary" href="/providers">Find providers</a></section></WorkspaceFrame>;
  return <PublicCatalogueDetail providerId={providerId} />;
}
