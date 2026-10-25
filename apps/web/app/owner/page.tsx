import OwnerWorkspace from "@/components/owner-workspace";

const allowedSections = new Set(["overview","orders","support","providers","customers","subscriptions","products","health","audit","settings"]);

export const metadata = { title: "Owner control centre | Doodhwala", robots: { index: false, follow: false } };

export default async function OwnerPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string | string[] }>;
}) {
  const query = await searchParams;
  const raw = Array.isArray(query.section) ? query.section[0] : query.section;
  const initialSection = allowedSections.has(raw ?? "") ? raw as "overview" | "orders" | "support" | "providers" | "customers" | "subscriptions" | "products" | "health" | "audit" | "settings" : "overview";
  return <OwnerWorkspace initialSection={initialSection} />;
}
