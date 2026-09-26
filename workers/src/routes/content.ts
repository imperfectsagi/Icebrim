import { Hono } from 'hono';
import type { Env } from '../lib/env';
import { getSiteContentWithMeta, applyRevalidatingCache, notModified } from '../lib/site-content';

const content = new Hono<{ Bindings: Env }>();

content.get('/home', async (c) => {
  const row = await getSiteContentWithMeta(c.env.DB, 'home');
  if (!row) return c.json({ error: 'Home content not found. Has it been seeded?' }, 404);
  // Carries the hero banner (image/video/mobile focal point) -- see
  // lib/site-content.ts's applyRevalidatingCache for why this is
  // revalidate-on-load rather than the previous fixed max-age=60 (Fix:
  // old content flash on refresh).
  const notModifiedResponse = notModified(c, row.updatedAt);
  if (notModifiedResponse) return notModifiedResponse;
  applyRevalidatingCache(c, row.updatedAt);
  return c.json(row.value);
});

content.get('/company', async (c) => {
  const row = await getSiteContentWithMeta(c.env.DB, 'company');
  if (!row) return c.json({ error: 'Company settings not found. Has it been seeded?' }, 404);
  const notModifiedResponse = notModified(c, row.updatedAt);
  if (notModifiedResponse) return notModifiedResponse;
  applyRevalidatingCache(c, row.updatedAt);
  return c.json(row.value);
});

// Policy pages (Privacy Policy, Cookie Policy, Terms & Conditions, Return &
// Refund Policy) -- public, unauthenticated read of admin-edited content.
// See routes/admin-content.ts for the write side and the fixed key
// allowlist (this route uses the same allowlist so an arbitrary :key can't
// probe unrelated site_content rows, e.g. 'theme' or 'system_settings').
const POLICY_KEYS = ['policy_privacy', 'policy_cookie', 'policy_terms', 'policy_refund'] as const;

content.get('/policy/:key', async (c) => {
  const key = c.req.param('key');
  if (!(POLICY_KEYS as readonly string[]).includes(key)) {
    return c.json({ error: 'Unknown policy page' }, 404);
  }
  const row = await getSiteContentWithMeta(c.env.DB, key);
  if (!row) return c.json({ error: 'Policy content not found. Has it been seeded?' }, 404);
  const notModifiedResponse = notModified(c, row.updatedAt);
  if (notModifiedResponse) return notModifiedResponse;
  applyRevalidatingCache(c, row.updatedAt);
  return c.json(row.value);
});

export default content;
