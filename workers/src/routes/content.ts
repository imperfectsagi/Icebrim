import { Hono } from 'hono';
import type { Env } from '../lib/env';

const content = new Hono<{ Bindings: Env }>();

async function getSiteContent(db: D1Database, key: string): Promise<unknown | null> {
  const row = await db.prepare('SELECT value FROM site_content WHERE key = ?').bind(key).first<{ value: string }>();
  if (!row) return null;
  try {
    return JSON.parse(row.value);
  } catch {
    return null;
  }
}

content.get('/home', async (c) => {
  const value = await getSiteContent(c.env.DB, 'home');
  if (!value) return c.json({ error: 'Home content not found. Has it been seeded?' }, 404);
  c.header('Cache-Control', 'public, max-age=60');
  return c.json(value);
});

content.get('/company', async (c) => {
  const value = await getSiteContent(c.env.DB, 'company');
  if (!value) return c.json({ error: 'Company settings not found. Has it been seeded?' }, 404);
  c.header('Cache-Control', 'public, max-age=300');
  return c.json(value);
});

// Policy pages (Privacy Policy, Cookie Policy, Terms & Conditions) --
// public, unauthenticated read of admin-edited content. See
// routes/admin-content.ts for the write side and the fixed key allowlist
// (this route uses the same allowlist so an arbitrary :key can't probe
// unrelated site_content rows, e.g. 'theme' or 'system_settings').
const POLICY_KEYS = ['policy_privacy', 'policy_cookie', 'policy_terms'] as const;

content.get('/policy/:key', async (c) => {
  const key = c.req.param('key');
  if (!(POLICY_KEYS as readonly string[]).includes(key)) {
    return c.json({ error: 'Unknown policy page' }, 404);
  }
  const value = await getSiteContent(c.env.DB, key);
  if (!value) return c.json({ error: 'Policy content not found. Has it been seeded?' }, 404);
  c.header('Cache-Control', 'public, max-age=60');
  return c.json(value);
});

export default content;
