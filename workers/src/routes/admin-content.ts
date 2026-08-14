import { Hono } from 'hono';
import type { Env } from '../lib/env';
import type { AuthedVariables } from '../middleware/auth';
import { requireAuth, requireAdminRole } from '../middleware/auth';
import { companySettingsWriteSchema, policyPageWriteSchema, promoBannerWriteSchema } from '../lib/schemas';
import { sanitizeBlogHtml } from '../lib/sanitize-html';
import { logAuditEvent, getClientIp } from '../lib/login-security';

export const adminContent = new Hono<{ Bindings: Env; Variables: AuthedVariables }>();
adminContent.use('*', requireAuth);

async function upsertSiteContent(db: D1Database, key: string, value: unknown, userId: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO site_content (key, value, updated_at, updated_by) VALUES (?, ?, datetime('now'), ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now'), updated_by = excluded.updated_by`,
    )
    .bind(key, JSON.stringify(value), userId)
    .run();
}

async function getSiteContentRaw(db: D1Database, key: string): Promise<unknown | null> {
  const row = await db.prepare('SELECT value FROM site_content WHERE key = ?').bind(key).first<{ value: string }>();
  if (!row) return null;
  try {
    return JSON.parse(row.value);
  } catch {
    return null;
  }
}

// Home page content: admin reads/writes the full JSON blob. Deep
// per-field Zod validation of every nested home-page section would add
// a large schema for limited benefit here (there's no cross-entity
// integrity to protect, unlike products/blog), so we validate structure
// at the type level in the frontend and cap the payload size here as a
// pragmatic safeguard against abuse.
const MAX_CONTENT_JSON_BYTES = 200_000;

adminContent.get('/home', async (c) => {
  const value = await getSiteContentRaw(c.env.DB, 'home');
  if (!value) return c.json({ error: 'Not seeded yet' }, 404);
  return c.json(value);
});

adminContent.put('/home', async (c) => {
  const body = await c.req.text();
  if (body.length > MAX_CONTENT_JSON_BYTES) return c.json({ error: 'Payload too large' }, 413);
  const parsed = JSON.parse(body);

  await upsertSiteContent(c.env.DB, 'home', parsed, c.get('userId'));
  await logAuditEvent(c.env.DB, {
    userId: c.get('userId'),
    action: 'home_content_updated',
    ip: getClientIp(c.req.raw.headers),
    userAgent: c.req.header('User-Agent') ?? null,
  });

  return c.json(parsed);
});

adminContent.get('/company', async (c) => {
  const value = await getSiteContentRaw(c.env.DB, 'company');
  if (!value) return c.json({ error: 'Not seeded yet' }, 404);
  return c.json(value);
});

adminContent.put('/company', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = companySettingsWriteSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid company settings' }, 400);

  await upsertSiteContent(c.env.DB, 'company', parsed.data, c.get('userId'));
  await logAuditEvent(c.env.DB, {
    userId: c.get('userId'),
    action: 'company_settings_updated',
    ip: getClientIp(c.req.raw.headers),
    userAgent: c.req.header('User-Agent') ?? null,
  });

  return c.json(parsed.data);
});

// ---------------------------------------------------------------------------
// SEO settings / System settings -- same pattern, admin-only (not editor)
// since these affect the whole site rather than individual content items.
// ---------------------------------------------------------------------------
export const adminSettings = new Hono<{ Bindings: Env; Variables: AuthedVariables }>();
adminSettings.use('*', requireAuth, requireAdminRole);

adminSettings.get('/seo', async (c) => {
  const value = await getSiteContentRaw(c.env.DB, 'seo_settings');
  return c.json(value ?? {});
});

adminSettings.put('/seo', async (c) => {
  const body = await c.req.text();
  if (body.length > MAX_CONTENT_JSON_BYTES) return c.json({ error: 'Payload too large' }, 413);
  const parsed = JSON.parse(body);
  await upsertSiteContent(c.env.DB, 'seo_settings', parsed, c.get('userId'));
  return c.json(parsed);
});

// ---------------------------------------------------------------------------
// Policy pages (Privacy Policy, Cookie Policy, Terms & Conditions) --
// same site_content key/value pattern as home/company above, so the admin
// can manage them without a code deployment for every text change. Content
// is sanitized server-side with the same allowlist sanitizer used for blog
// posts (see lib/sanitize-html.ts) since it's rendered with
// dangerouslySetInnerHTML on the public site (see src/components/common/
// RichText.tsx, which also re-sanitizes client-side as defense in depth).
//
// Keyed as 'policy_privacy' / 'policy_cookie' / 'policy_terms' in
// site_content -- three fixed keys (not a generic "any slug" CMS) because
// there are exactly three policy pages the frontend routes to
// (PrivacyPolicyPage / CookiePolicyPage / TermsPage, see src/router.tsx),
// and an open-ended slug system would need its own routing/404 handling
// this app doesn't have.
// ---------------------------------------------------------------------------
const POLICY_KEYS = ['policy_privacy', 'policy_cookie', 'policy_terms'] as const;
type PolicyKey = (typeof POLICY_KEYS)[number];

function isPolicyKey(value: string): value is PolicyKey {
  return (POLICY_KEYS as readonly string[]).includes(value);
}

adminContent.get('/policy/:key', async (c) => {
  const key = c.req.param('key');
  if (!isPolicyKey(key)) return c.json({ error: 'Unknown policy page' }, 404);

  const value = await getSiteContentRaw(c.env.DB, key);
  if (!value) return c.json({ error: 'Not seeded yet' }, 404);
  return c.json(value);
});

adminContent.put('/policy/:key', async (c) => {
  const key = c.req.param('key');
  if (!isPolicyKey(key)) return c.json({ error: 'Unknown policy page' }, 404);

  const body = await c.req.json().catch(() => null);
  const parsed = policyPageWriteSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid policy page content' }, 400);

  const clean = { ...parsed.data, contentHtml: sanitizeBlogHtml(parsed.data.contentHtml) };
  await upsertSiteContent(c.env.DB, key, clean, c.get('userId'));
  await logAuditEvent(c.env.DB, {
    userId: c.get('userId'),
    action: 'policy_page_updated',
    ip: getClientIp(c.req.raw.headers),
    userAgent: c.req.header('User-Agent') ?? null,
    metadata: { policyKey: key },
  });

  return c.json(clean);
});

// Delete = reset to empty rather than removing the row entirely: the
// public page component (PrivacyPolicyPage.tsx etc.) always renders at
// its fixed route regardless of whether content has been saved, so a
// missing site_content row would show a 404-shaped "Not seeded yet" API
// response, and the public page falls back to an "unavailable" state
// instead of erroring. This matches the effect the client asked for
// ("admin can delete a policy page's content") without introducing a
// separate "does this route exist" concept the frontend router doesn't
// otherwise have.
adminContent.delete('/policy/:key', async (c) => {
  const key = c.req.param('key');
  if (!isPolicyKey(key)) return c.json({ error: 'Unknown policy page' }, 404);

  await c.env.DB.prepare('DELETE FROM site_content WHERE key = ?').bind(key).run();
  await logAuditEvent(c.env.DB, {
    userId: c.get('userId'),
    action: 'policy_page_deleted',
    ip: getClientIp(c.req.raw.headers),
    userAgent: c.req.header('User-Agent') ?? null,
    metadata: { policyKey: key },
  });

  return c.body(null, 204);
});

// ---------------------------------------------------------------------------
// Theme (brand accent color) -- same site_content pattern as the rest of
// this file. Stored as a single hex color; the frontend applies it by
// overriding the --color-coral* CSS variables at the document root, so one
// saved value re-colors buttons, links, active nav state, and focus rings
// across both the public site and the admin panel without touching
// individual components.
// ---------------------------------------------------------------------------
const hexColor = /^#[0-9a-fA-F]{6}$/;

adminSettings.get('/theme', async (c) => {
  const value = await getSiteContentRaw(c.env.DB, 'theme');
  return c.json(value ?? { accentColor: '#11534E' });
});

adminSettings.put('/theme', async (c) => {
  const body = await c.req.json().catch(() => null);
  const accentColor = (body as { accentColor?: string } | null)?.accentColor;
  if (typeof accentColor !== 'string' || !hexColor.test(accentColor)) {
    return c.json({ error: 'accentColor must be a hex color like #11534E' }, 400);
  }

  await upsertSiteContent(c.env.DB, 'theme', { accentColor }, c.get('userId'));
  await logAuditEvent(c.env.DB, {
    userId: c.get('userId'),
    action: 'theme_updated',
    ip: getClientIp(c.req.raw.headers),
    userAgent: c.req.header('User-Agent') ?? null,
    metadata: { accentColor },
  });

  return c.json({ accentColor });
});

// ---------------------------------------------------------------------------
// Promo banner note -- a site-wide ON/OFF announcement strip (e.g. "Free
// shipping this weekend"), optionally linking to one product or page by
// slug. Same site_content key/value pattern as theme/home above. Kept
// admin-only (not requireAdminRole) since editors already manage
// comparable site-wide text content (home banner, policy pages) via
// adminContent elsewhere in this file.
// ---------------------------------------------------------------------------
adminContent.get('/promo-banner', async (c) => {
  const value = await getSiteContentRaw(c.env.DB, 'promo_banner');
  return c.json(value ?? { enabled: false, text: '', linkType: 'none', linkSlug: '' });
});

adminContent.put('/promo-banner', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = promoBannerWriteSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid promo banner content' }, 400);

  await upsertSiteContent(c.env.DB, 'promo_banner', parsed.data, c.get('userId'));
  await logAuditEvent(c.env.DB, {
    userId: c.get('userId'),
    action: 'promo_banner_updated',
    ip: getClientIp(c.req.raw.headers),
    userAgent: c.req.header('User-Agent') ?? null,
    metadata: { enabled: parsed.data.enabled },
  });

  return c.json(parsed.data);
});

adminSettings.get('/system', async (c) => {
  const value = await getSiteContentRaw(c.env.DB, 'system_settings');
  return c.json(value ?? { maintenanceMode: false, maintenanceMessage: '', sessionTimeoutMinutes: 15 });
});

adminSettings.put('/system', async (c) => {
  const body = await c.req.text();
  if (body.length > MAX_CONTENT_JSON_BYTES) return c.json({ error: 'Payload too large' }, 413);
  const parsed = JSON.parse(body);
  await upsertSiteContent(c.env.DB, 'system_settings', parsed, c.get('userId'));

  await logAuditEvent(c.env.DB, {
    userId: c.get('userId'),
    action: 'system_settings_updated',
    ip: getClientIp(c.req.raw.headers),
    userAgent: c.req.header('User-Agent') ?? null,
    metadata: { maintenanceMode: !!(parsed as { maintenanceMode?: boolean }).maintenanceMode },
  });

  return c.json(parsed);
});

// ---------------------------------------------------------------------------
// Public: maintenance-mode flag only. Deliberately separate from the
// authenticated /api/admin/settings/system route above -- the public site
// needs to read this on every visit (no auth cookie required, cacheable),
// while the full settings object (session timeout, etc.) stays admin-only.
// ---------------------------------------------------------------------------
export const publicSettings = new Hono<{ Bindings: Env }>();

publicSettings.get('/maintenance', async (c) => {
  const value = (await getSiteContentRaw(c.env.DB, 'system_settings')) as
    | { maintenanceMode?: boolean; maintenanceMessage?: string }
    | null;
  c.header('Cache-Control', 'public, max-age=30');
  return c.json({
    maintenanceMode: value?.maintenanceMode ?? false,
    maintenanceMessage: value?.maintenanceMessage ?? "We'll be back shortly.",
  });
});

publicSettings.get('/theme', async (c) => {
  const value = (await getSiteContentRaw(c.env.DB, 'theme')) as { accentColor?: string } | null;
  c.header('Cache-Control', 'public, max-age=300');
  return c.json({ accentColor: value?.accentColor ?? '#11534E' });
});

publicSettings.get('/promo-banner', async (c) => {
  const value = (await getSiteContentRaw(c.env.DB, 'promo_banner')) as
    | { enabled?: boolean; text?: string; linkType?: 'none' | 'product' | 'page'; linkSlug?: string }
    | null;
  c.header('Cache-Control', 'public, max-age=30');
  return c.json({
    enabled: value?.enabled ?? false,
    text: value?.text ?? '',
    linkType: value?.linkType ?? 'none',
    linkSlug: value?.linkSlug ?? '',
  });
});
