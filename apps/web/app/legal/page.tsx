import WorkspaceFrame from "@/components/workspace-frame";

export const metadata = { title: "Marketplace information | Doodhwala" };

export default function LegalPage() {
  return (
    <WorkspaceFrame title="Marketplace information" description="Understand how Doodhwala connects customers with independent local milk sellers.">
      <section className="workspace-card">
        <p className="workspace-eyebrow">IMPORTANT INFORMATION</p>
        <h2>Independent local marketplace</h2>
        <p>Doodhwala helps customers discover independent milk sellers. The seller fulfils the order and receives direct UPI or cash-on-delivery payments. Doodhwala does not collect these direct seller payments in the current marketplace flow.</p>
        <h3>Privacy and account data</h3>
        <p>Use your account pages to manage your profile and delivery addresses. Public discovery pages request location only after you choose to share it. Do not include passwords, OTPs or sensitive payment credentials in notes or support tickets.</p>
        <h3>Orders, cancellations and subscriptions</h3>
        <p>Order cancellation, payment confirmation and subscription changes are subject to the active server-side rules, delivery cutoffs and seller operations. The relevant screens display the current recorded state.</p>
        <h3>Policy status</h3>
        <p className="workspace-notice info">The repository’s legacy legal documents are marked as drafts pending formal review. This page is informational and is not a final legal agreement. Before launch, replace the draft policies with reviewed privacy, marketplace, refund/cancellation and seller terms.</p>
        <h3>Need help?</h3><p><a className="workspace-inline-link" href="/support">Open a support request →</a></p>
      </section>
    </WorkspaceFrame>
  );
}
