import SubscriptionsWorkspace from "@/components/subscriptions-workspace";
export const metadata = { title: "Subscription details | Doodhwala", robots: { index: false, follow: false } };
export default async function SubscriptionDetailPage({ params }: { params: Promise<{ subscriptionId: string }> }) {
  const { subscriptionId } = await params;
  return <SubscriptionsWorkspace subscriptionId={subscriptionId} />;
}
