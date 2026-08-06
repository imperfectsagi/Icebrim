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

export default content;
