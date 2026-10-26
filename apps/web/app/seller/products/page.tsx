import SellerWorkspace from "@/components/seller-workspace";
export const metadata = { title: "Manage products | Doodhwala", robots: { index: false, follow: false } };
export default function SellerProductsPage() { return <SellerWorkspace initialSection="products" />; }
