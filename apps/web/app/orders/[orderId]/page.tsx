import OrdersWorkspace from "@/components/orders-workspace";
export const metadata = { title: "Order details | Doodhwala", robots: { index: false, follow: false } };
export default async function OrderDetailPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return <OrdersWorkspace orderId={orderId} />;
}
