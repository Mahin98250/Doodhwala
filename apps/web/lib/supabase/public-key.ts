/**
 * Only accepts public Supabase project keys for browser-side usage.
 * Rejects Supabase secret keys and legacy JWTs carrying the service_role claim.
 */
export function isPublicSupabaseKey(value: string): boolean {
  const key = value.trim();
  if (!key) return false;
  if (key.startsWith("sb_publishable_")) return true;
  if (key.startsWith("sb_secret_")) return false;

  const parts = key.split(".");
  if (parts.length !== 3 || !parts[1]) return false;

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const payload = JSON.parse(atob(padded)) as { role?: unknown };
    return payload.role === "anon";
  } catch {
    return false;
  }
}
