import { redirect } from "next/navigation";
export default async function LegacyPlansAlias({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const parameters = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (typeof value === "string") parameters.set(key, value);
  const suffix = parameters.toString();
  redirect("/subscriptions" + (suffix ? "?" + suffix : ""));
}
