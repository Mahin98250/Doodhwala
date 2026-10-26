export interface SupabasePublicConfig {
  url: string;
  anonKey: string;
}

/**
 * Accept only HTTPS project URLs (or loopback HTTP for local development).
 * Public browser/mobile keys may be exposed in app bundles; service-role/secret
 * keys must never be configured here.
 */
export function normalizeSupabaseUrl(value: string | undefined): string | null {
  const candidate = value?.trim();
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    const isLoopback = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
    if (url.protocol !== "https:" && !(isLoopback && url.protocol === "http:")) return null;
    if (!url.hostname || url.username || url.password || url.search || url.hash) return null;
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function normalizeSupabasePublicKey(value: string | undefined): string | null {
  const key = value?.trim();
  if (!key || /^(sb_secret_|service_role_)/i.test(key)) return null;
  // Current publishable keys and legacy anon JWTs are supported. We cannot
  // infer legacy JWT role claims without decoding them, so staging setup must
  // still verify the key in the Supabase dashboard before shipping.
  if (key.startsWith("sb_publishable_")) return key.length > "sb_publishable_".length ? key : null;
  if (key.split(".").length === 3 && key.length > 40) return key;
  return null;
}

export function getSupabasePublicConfig(url: string | undefined, key: string | undefined): SupabasePublicConfig | null {
  const normalizedUrl = normalizeSupabaseUrl(url);
  const normalizedKey = normalizeSupabasePublicKey(key);
  return normalizedUrl && normalizedKey ? { url: normalizedUrl, anonKey: normalizedKey } : null;
}
