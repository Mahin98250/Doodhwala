import SellerWorkspace from "@/components/seller-workspace";

export const metadata = { title: "Seller command centre | Doodhwala", robots: { index: false, follow: false } };

export default async function SellerPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const query = await searchParams;
  const raw = Array.isArray(query.view) ? query.view[0] : query.view;
  const initialSection = raw === "products" || raw === "catalogue" ? "products"
    : raw === "deliveries" || raw === "dispatch" || raw === "orders" ? "deliveries"
    : "dashboard";
  return <SellerWorkspace initialSection={initialSection} />;
}
