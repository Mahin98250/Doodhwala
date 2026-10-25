import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isPublicSupabaseKey } from "./public-key";

let browserClient: SupabaseClient | null = null;

/**
 * Uses only a browser-safe Supabase key. Secret/service-role credentials are
 * rejected before the client library is initialized.
 */
export function getBrowserSupabaseClient(): SupabaseClient | null {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const rawKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!rawUrl || !rawKey || !isPublicSupabaseKey(rawKey)) return null;
  if (typeof window === "undefined") return null;

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  const localHost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(localHost && url.protocol === "http:")) return null;

  if (!browserClient) {
    browserClient = createClient(url.toString(), rawKey.trim(), {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }

  return browserClient;
}
