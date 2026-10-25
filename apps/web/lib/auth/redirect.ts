/**
 * Resolve a post-authentication return path without permitting external redirects.
 * Kept pure so open-redirect cases can be tested without a browser or Supabase.
 */
export function getSafeReturnPath(value: string | null | undefined, origin: string): string {
  if (!value) return "/";
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\u0000-\u001f]/.test(value)) return "/";
  try {
    const target = new URL(value, origin);
    if (target.origin !== origin) return "/";
    return target.pathname + target.search + target.hash;
  } catch {
    return "/";
  }
}
