import WorkspaceFrame from "@/components/workspace-frame";

export const metadata = { title: "You are offline | Doodhwala", robots: { index: false, follow: false } };

export default function OfflinePage() {
  return (
    <WorkspaceFrame title="You may be offline" description="Doodhwala needs a connection for live seller listings, prices, order placement and payment-state checks.">
      <section className="workspace-card workspace-empty">
        <div className="workspace-item-icon">↯</div>
        <h2>Reconnect to continue safely</h2>
        <p>Your cart is kept in this browser where storage is available. Do not assume an order has been placed until you see its server-confirmed order reference.</p>
        <div className="workspace-actions"><a className="workspace-button workspace-button-primary" href="/">Try home</a><a className="workspace-button workspace-button-secondary" href="/cart">Review local cart</a></div>
      </section>
    </WorkspaceFrame>
  );
}
