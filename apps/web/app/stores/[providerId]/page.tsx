import type { Metadata } from "next";
import PublicCatalogueDetail from "@/components/public-catalogue-detail";

export const metadata: Metadata = {
  title: "Local seller catalogue | Doodhwala",
  description: "Review a local milk seller's published catalogue and delivery information.",
  robots: { index: false, follow: true },
};

export default async function StorePage({
  params,
}: {
  params: Promise<{ providerId: string }>;
}) {
  const { providerId } = await params;
  return <PublicCatalogueDetail providerId={providerId} />;
}
