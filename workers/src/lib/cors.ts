/**
 * CORS origin matching
 * ---------------------
 * `PUBLIC_SITE_URL` may contain a single origin or a comma-separated list,
 * e.g. "https://icebrim.pages.dev,https://icebrim.com,https://www.icebrim.com".
 * This lets the same Worker serve a Cloudflare Pages preview domain, a
 * connected custom domain, and a www-prefixed variant at the same time --
 * whatever domain the request's Origin header matches, as long as it's in
 * this list, is allowed. Anything not listed (and not localhost, for local
 * dev) is rejected, so this stays a real allowlist rather than a wildcard.
 */
export function parseAllowedOrigins(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
    // normalize away a trailing slash so "https://icebrim.com/" still matches
    .map((o) => o.replace(/\/+$/, ''));
}

export function isOriginAllowed(origin: string | undefined, allowedOrigins: string[]): boolean {
  if (!origin) return false;
  const normalized = origin.replace(/\/+$/, '');
  if (allowedOrigins.includes(normalized)) return true;
  return normalized.startsWith('http://localhost') || normalized.startsWith('http://127.0.0.1');
}
