import type { Context } from 'hono';

/**
 * Shared read/write helpers for the `site_content` key/value table (home
 * page content, company settings, theme, promo banner, delivery info,
 * popup offer, etc -- see migration 0001_initial_schema.sql). Pulled out
 * of routes/admin-content.ts and routes/content.ts (which both used to
 * have their own near-identical copies) so there is exactly one
 * implementation of "read/write a site_content row" and exactly one place
 * that decides how these public GETs are cached -- see
 * applyRevalidatingCache below for why that consolidation is what
 * actually fixes the stale-content-flash-on-refresh bug (Fix: old content
 * flash on refresh).
 */

export async function upsertSiteContent(db: D1Database, key: string, value: unknown, userId: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO site_content (key, value, updated_at, updated_by) VALUES (?, ?, datetime('now'), ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now'), updated_by = excluded.updated_by`,
    )
    .bind(key, JSON.stringify(value), userId)
    .run();
}

export async function getSiteContentRaw(db: D1Database, key: string): Promise<unknown | null> {
  const row = await db.prepare('SELECT value FROM site_content WHERE key = ?').bind(key).first<{ value: string }>();
  if (!row) return null;
  try {
    return JSON.parse(row.value);
  } catch {
    return null;
  }
}

/**
 * Same read as getSiteContentRaw, but also returns the row's updated_at
 * timestamp -- needed to build the ETag that applyRevalidatingCache uses
 * below. A separate function (rather than changing getSiteContentRaw's
 * signature) so every existing call site that only needs the value keeps
 * working unchanged.
 */
export async function getSiteContentWithMeta(
  db: D1Database,
  key: string,
): Promise<{ value: unknown; updatedAt: string } | null> {
  const row = await db.prepare('SELECT value, updated_at FROM site_content WHERE key = ?').bind(key).first<{
    value: string;
    updated_at: string;
  }>();
  if (!row) return null;
  try {
    return { value: JSON.parse(row.value), updatedAt: row.updated_at };
  } catch {
    return null;
  }
}

/**
 * ---------------------------------------------------------------------
 * Fix: old content briefly appearing on refresh after an admin edit
 * ---------------------------------------------------------------------
 * Root cause: the public content/settings endpoints (home content,
 * banner media, theme color) were sent with `Cache-Control: public,
 * max-age=<N>`. `public` makes the response eligible for Cloudflare's
 * shared edge cache, not just the visitor's own browser cache -- and
 * this codebase has no cache-purge step anywhere an admin save happens
 * (upsertSiteContent above just writes to D1; nothing calls the
 * Cloudflare cache-purge API). So for up to N seconds after an admin
 * changes the banner/theme/home content, a visitor's reload could be
 * served the previous edge- or browser-cached response instead of the
 * one that was just saved -- the "old version briefly appears during
 * refresh" symptom.
 *
 * Fix, applied to every "current admin-controlled visual content"
 * endpoint (home, theme, promo-banner, popup-offer): keep the response
 * cacheable (per the brief: don't unnecessarily disable Cloudflare
 * caching/CDN) but require revalidation on every use, via `no-cache`
 * (a real HTTP cache directive -- NOT "don't cache," but "cache it, just
 * always check back before reusing it") plus a strong ETag derived from
 * the row's own updated_at. A cache (browser or Cloudflare edge) that
 * respects this always makes a conditional GET; when the content hasn't
 * changed, D1/the Worker still does the read but the Worker replies 304
 * with no body, so this is nearly as cheap as the old max-age behavior
 * while never being able to serve a stale body after a save -- the two
 * can no longer disagree, because there is no window where a cached
 * response is reused without checking the current updated_at first.
 *
 * Endpoints that aren't admin-visually-editable in a way that would
 * visibly "flash" (e.g. the sitemap, product/blog listing endpoints,
 * uploaded media which is immutable per-URL) are unaffected by this
 * change and keep their existing max-age caching -- this fix is scoped
 * to the specific content this bug report named.
 */
export function applyRevalidatingCache(c: Context, updatedAt: string | undefined): void {
  c.header('Cache-Control', 'public, no-cache');
  if (updatedAt) {
    // Weak ETag: the comparison that matters here is "did the row
    // change," not byte-for-byte identity, and a weak tag lets
    // Cloudflare/browsers still revalidate correctly across the
    // JSON.stringify formatting being logically-equivalent-but-not-
    // byte-identical between requests.
    c.header('ETag', `W/"${sanitizeForETag(updatedAt)}"`);
  }
}

/**
 * Checks the request's If-None-Match against the current row's
 * updated_at and, if they match, returns a ready-to-return 304 response
 * (also carrying the same Cache-Control/ETag headers a fresh 200 would
 * have, per HTTP semantics for conditional responses). Returns null if
 * the caller should proceed to send a normal 200 body -- either because
 * there was no conditional request, or because the content has actually
 * changed since the client's cached copy.
 *
 * Hono's core Context doesn't evaluate conditional requests on its own
 * (that's normally opt-in `etag()` middleware); this is implemented
 * directly here, scoped to just the handful of endpoints this fix
 * applies to, rather than adding blanket middleware that would change
 * caching behavior for every route in the app.
 */
export function notModified(c: Context, updatedAt: string | undefined): Response | null {
  if (!updatedAt) return null;
  const etag = `W/"${sanitizeForETag(updatedAt)}"`;
  const ifNoneMatch = c.req.header('If-None-Match');
  if (ifNoneMatch !== etag) return null;

  c.header('Cache-Control', 'public, no-cache');
  c.header('ETag', etag);
  return c.body(null, 304);
}

function sanitizeForETag(updatedAt: string): string {
  // ETags must not contain unescaped quotes/control characters -- the
  // stored updated_at is always a plain `datetime('now')` SQLite string
  // (e.g. "2026-09-26 10:15:00") with none of those, but this strips
  // defensively rather than assuming that never changes.
  return updatedAt.replace(/["\r\n]/g, '');
}
