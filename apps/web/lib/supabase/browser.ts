import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { normalizeSupabaseUrl } from "./config";
import { isPublicSupabaseKey } from "./public-key";

let browserClient: SupabaseClient | null = null;

/**
 * Uses only a browser-safe Supabase key. Secret/service-role credentials are
 * rejected before the client library is initialized. A single client is reused
 * for this browser runtime to avoid duplicate auth listeners and token refreshes.
 */
export function getBrowserSupabaseClient(): SupabaseClient | null {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const rawKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!rawUrl || !rawKey || !isPublicSupabaseKey(rawKey)) return null;

  const projectUrl = normalizeSupabaseUrl(rawUrl);
  if (!projectUrl || typeof window === "undefined") return null;

  if (!browserClient) {
    browserClient = createClient(projectUrl, rawKey.trim(), {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }

  return browserClient;
}
