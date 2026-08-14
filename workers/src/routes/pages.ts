import { Hono } from 'hono';
import type { Env } from '../lib/env';
import type { AuthedVariables } from '../middleware/auth';
import { requireAuth } from '../middleware/auth';
import { pageWriteSchema } from '../lib/schemas';
import { sanitizeBlogHtml } from '../lib/sanitize-html';
import { logAuditEvent, getClientIp } from '../lib/login-security';

// Public read-only routes -- same shape/pattern as routes/blog.ts.
const pages = new Hono<{ Bindings: Env }>();

interface PageRow {
  id: string;
  slug: string;
  title: string;
  content_html: string;
  status: 'draft' | 'published';
  seo_title: string;
  seo_description: string;
  created_at: string;
  updated_at: string;
}

function serializePage(row: PageRow) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    contentHtml: row.content_html,
    status: row.status,
    seo: { title: row.seo_title, description: row.seo_description },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

pages.get('/:slug', async (c) => {
  const row = await c.env.DB.prepare(`SELECT * FROM pages WHERE slug = ? AND status = 'published'`)
    .bind(c.req.param('slug'))
    .first<PageRow>();
  if (!row) return c.json({ error: 'Page not found' }, 404);
  c.header('Cache-Control', 'public, max-age=60');
  return c.json(serializePage(row));
});

export const adminPages = new Hono<{ Bindings: Env; Variables: AuthedVariables }>();
adminPages.use('*', requireAuth);

adminPages.get('/', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM pages ORDER BY updated_at DESC').all<PageRow>();
  return c.json(results.map(serializePage));
});

adminPages.get('/:id', async (c) => {
  const row = await c.env.DB.prepare('SELECT * FROM pages WHERE id = ?').bind(c.req.param('id')).first<PageRow>();
  if (!row) return c.json({ error: 'Page not found' }, 404);
  return c.json(serializePage(row));
});

adminPages.post('/', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = pageWriteSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid page data' }, 400);
  const input = parsed.data;

  const existingSlug = await c.env.DB.prepare('SELECT id FROM pages WHERE slug = ?').bind(input.slug).first();
  if (existingSlug) return c.json({ error: 'A page with this URL slug already exists' }, 409);

  const id = `page_${crypto.randomUUID()}`;
  const cleanHtml = sanitizeBlogHtml(input.contentHtml);

  await c.env.DB.prepare(
    `INSERT INTO pages (id, slug, title, content_html, status, seo_title, seo_description, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, input.slug, input.title, cleanHtml, input.status, input.seo.title, input.seo.description, c.get('userId'))
    .run();

  await logAuditEvent(c.env.DB, {
    userId: c.get('userId'),
    action: 'page_created',
    ip: getClientIp(c.req.raw.headers),
    userAgent: c.req.header('User-Agent') ?? null,
    metadata: { pageId: id, slug: input.slug },
  });

  const row = await c.env.DB.prepare('SELECT * FROM pages WHERE id = ?').bind(id).first<PageRow>();
  return c.json(serializePage(row!), 201);
});

adminPages.put('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => null);
  const parsed = pageWriteSchema.partial().safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid page data' }, 400);
  const input = parsed.data;

  const existing = await c.env.DB.prepare('SELECT id FROM pages WHERE id = ?').bind(id).first();
  if (!existing) return c.json({ error: 'Page not found' }, 404);

  if (input.slug !== undefined) {
    const slugTaken = await c.env.DB.prepare('SELECT id FROM pages WHERE slug = ? AND id != ?').bind(input.slug, id).first();
    if (slugTaken) return c.json({ error: 'A page with this URL slug already exists' }, 409);
  }

  const fieldMap: Record<string, unknown> = {};
  if (input.title !== undefined) fieldMap.title = input.title;
  if (input.slug !== undefined) fieldMap.slug = input.slug;
  if (input.contentHtml !== undefined) fieldMap.content_html = sanitizeBlogHtml(input.contentHtml);
  if (input.status !== undefined) fieldMap.status = input.status;
  if (input.seo?.title !== undefined) fieldMap.seo_title = input.seo.title;
  if (input.seo?.description !== undefined) fieldMap.seo_description = input.seo.description;

  if (Object.keys(fieldMap).length > 0) {
    const setClauses = Object.keys(fieldMap).map((k) => `${k} = ?`).join(', ');
    await c.env.DB.prepare(`UPDATE pages SET ${setClauses}, updated_at = datetime('now') WHERE id = ?`)
      .bind(...Object.values(fieldMap), id)
      .run();
  }

  await logAuditEvent(c.env.DB, {
    userId: c.get('userId'),
    action: 'page_updated',
    ip: getClientIp(c.req.raw.headers),
    userAgent: c.req.header('User-Agent') ?? null,
    metadata: { pageId: id },
  });

  const row = await c.env.DB.prepare('SELECT * FROM pages WHERE id = ?').bind(id).first<PageRow>();
  return c.json(serializePage(row!));
});

// Publish/unpublish as a distinct, explicit action (in addition to being
// settable via the general PUT above) -- mirrors the moderate-style
// pattern used for reviews (reviewModerateSchema) so the admin UI can
// offer a single-click toggle without resending the full page body.
adminPages.patch('/:id/status', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => null);
  const status = (body as { status?: string } | null)?.status;
  if (status !== 'draft' && status !== 'published') {
    return c.json({ error: 'status must be "draft" or "published"' }, 400);
  }

  const existing = await c.env.DB.prepare('SELECT id FROM pages WHERE id = ?').bind(id).first();
  if (!existing) return c.json({ error: 'Page not found' }, 404);

  await c.env.DB.prepare(`UPDATE pages SET status = ?, updated_at = datetime('now') WHERE id = ?`).bind(status, id).run();

  await logAuditEvent(c.env.DB, {
    userId: c.get('userId'),
    action: status === 'published' ? 'page_published' : 'page_unpublished',
    ip: getClientIp(c.req.raw.headers),
    userAgent: c.req.header('User-Agent') ?? null,
    metadata: { pageId: id },
  });

  const row = await c.env.DB.prepare('SELECT * FROM pages WHERE id = ?').bind(id).first<PageRow>();
  return c.json(serializePage(row!));
});

adminPages.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const existing = await c.env.DB.prepare('SELECT id FROM pages WHERE id = ?').bind(id).first();
  if (!existing) return c.json({ error: 'Page not found' }, 404);

  await c.env.DB.prepare('DELETE FROM pages WHERE id = ?').bind(id).run();
  await logAuditEvent(c.env.DB, {
    userId: c.get('userId'),
    action: 'page_deleted',
    ip: getClientIp(c.req.raw.headers),
    userAgent: c.req.header('User-Agent') ?? null,
    metadata: { pageId: id },
  });
  return c.body(null, 204);
});

export default pages;
