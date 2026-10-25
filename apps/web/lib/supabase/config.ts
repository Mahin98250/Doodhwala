/**
 * Validates and normalizes a Supabase project URL before creating a browser client.
 * Supports hosted Supabase and HTTPS self-hosted instances, plus local HTTP development.
 */
export function normalizeSupabaseUrl(value: string): string | null {
  const candidate = value.trim();
  if (!candidate) return null;

  try {
    const url = new URL(candidate);
    const localHost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.protocol !== "https:" && !(localHost && url.protocol === "http:")) return null;
    if (!url.hostname || url.username || url.password || url.search || url.hash) return null;
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}
