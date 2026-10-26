import { redirect } from "next/navigation";

export default async function AuthAliasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = new URLSearchParams();
  for (const key of ["return", "reset", "oauth"]) {
    const value = params[key];
    if (typeof value === "string" && value.length <= 2000) next.set(key, value);
  }
  if (next.get("reset") === "1") {
    next.delete("reset");
    redirect("/auth/reset-password" + (next.size ? "?" + next.toString() : ""));
  }
  redirect("/auth/sign-in" + (next.size ? "?" + next.toString() : ""));
}
