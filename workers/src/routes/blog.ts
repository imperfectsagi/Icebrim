import { Hono } from 'hono';
import type { Env } from '../lib/env';
import type { AuthedVariables } from '../middleware/auth';
import { requireAuth } from '../middleware/auth';
import { blogWriteSchema } from '../lib/schemas';
import { sanitizeBlogHtml } from '../lib/sanitize-html';
import { logAuditEvent, getClientIp } from '../lib/login-security';

const blog = new Hono<{ Bindings: Env }>();

interface BlogRow {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content_html: string;
  featured_image_src: string;
  featured_image_alt: string;
  category: string;
  tags: string;
  author: string;
  status: 'draft' | 'published';
  published_at: string;
  seo_title: string;
  seo_description: string;
}

function serializeBlog(row: BlogRow) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    contentHtml: row.content_html,
    featuredImage: { src: row.featured_image_src, alt: row.featured_image_alt },
    category: row.category,
    tags: JSON.parse(row.tags),
    author: row.author,
    status: row.status,
    publishedAt: row.published_at,
    seo: { title: row.seo_title, description: row.seo_description },
  };
}

blog.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM blog_posts WHERE status = 'published' ORDER BY published_at DESC`,
  ).all<BlogRow>();
  c.header('Cache-Control', 'public, max-age=60');
  return c.json(results.map(serializeBlog));
});

blog.get('/:slug', async (c) => {
  const row = await c.env.DB.prepare(`SELECT * FROM blog_posts WHERE slug = ? AND status = 'published'`)
    .bind(c.req.param('slug'))
    .first<BlogRow>();
  if (!row) return c.json({ error: 'Post not found' }, 404);
  c.header('Cache-Control', 'public, max-age=60');
  return c.json(serializeBlog(row));
});

export const adminBlog = new Hono<{ Bindings: Env; Variables: AuthedVariables }>();
adminBlog.use('*', requireAuth);

adminBlog.get('/', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM blog_posts ORDER BY created_at DESC').all<BlogRow>();
  return c.json(results.map(serializeBlog));
});

adminBlog.post('/', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = blogWriteSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid post data' }, 400);
  const input = parsed.data;

  const existingSlug = await c.env.DB.prepare('SELECT id FROM blog_posts WHERE slug = ?').bind(input.slug).first();
  if (existingSlug) return c.json({ error: 'A post with this URL slug already exists' }, 409);

  const id = `post_${crypto.randomUUID()}`;
  const cleanHtml = sanitizeBlogHtml(input.contentHtml);

  await c.env.DB.prepare(
    `INSERT INTO blog_posts (id, slug, title, excerpt, content_html, featured_image_src, featured_image_alt,
       category, tags, author, status, published_at, seo_title, seo_description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id, input.slug, input.title, input.excerpt, cleanHtml, input.featuredImage.src, input.featuredImage.alt,
      input.category, JSON.stringify(input.tags), input.author, input.status, input.publishedAt,
      input.seo.title, input.seo.description,
    )
    .run();

  await logAuditEvent(c.env.DB, {
    userId: c.get('userId'),
    action: 'blog_post_created',
    ip: getClientIp(c.req.raw.headers),
    userAgent: c.req.header('User-Agent') ?? null,
    metadata: { postId: id, slug: input.slug },
  });

  return c.json({ ...input, id, contentHtml: cleanHtml }, 201);
});

adminBlog.put('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => null);
  const parsed = blogWriteSchema.partial().safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid post data' }, 400);
  const input = parsed.data;

  const existing = await c.env.DB.prepare('SELECT id FROM blog_posts WHERE id = ?').bind(id).first();
  if (!existing) return c.json({ error: 'Post not found' }, 404);

  const fieldMap: Record<string, unknown> = {};
  if (input.title !== undefined) fieldMap.title = input.title;
  if (input.slug !== undefined) fieldMap.slug = input.slug;
  if (input.excerpt !== undefined) fieldMap.excerpt = input.excerpt;
  if (input.contentHtml !== undefined) fieldMap.content_html = sanitizeBlogHtml(input.contentHtml);
  if (input.featuredImage?.src !== undefined) fieldMap.featured_image_src = input.featuredImage.src;
  if (input.featuredImage?.alt !== undefined) fieldMap.featured_image_alt = input.featuredImage.alt;
  if (input.category !== undefined) fieldMap.category = input.category;
  if (input.tags !== undefined) fieldMap.tags = JSON.stringify(input.tags);
  if (input.author !== undefined) fieldMap.author = input.author;
  if (input.status !== undefined) fieldMap.status = input.status;
  if (input.publishedAt !== undefined) fieldMap.published_at = input.publishedAt;
  if (input.seo?.title !== undefined) fieldMap.seo_title = input.seo.title;
  if (input.seo?.description !== undefined) fieldMap.seo_description = input.seo.description;

  if (Object.keys(fieldMap).length > 0) {
    const setClauses = Object.keys(fieldMap).map((k) => `${k} = ?`).join(', ');
    await c.env.DB.prepare(`UPDATE blog_posts SET ${setClauses}, updated_at = datetime('now') WHERE id = ?`)
      .bind(...Object.values(fieldMap), id)
      .run();
  }

  await logAuditEvent(c.env.DB, {
    userId: c.get('userId'),
    action: 'blog_post_updated',
    ip: getClientIp(c.req.raw.headers),
    userAgent: c.req.header('User-Agent') ?? null,
    metadata: { postId: id },
  });

  const row = await c.env.DB.prepare('SELECT * FROM blog_posts WHERE id = ?').bind(id).first<BlogRow>();
  return c.json(serializeBlog(row!));
});

adminBlog.delete('/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM blog_posts WHERE id = ?').bind(id).run();
  await logAuditEvent(c.env.DB, {
    userId: c.get('userId'),
    action: 'blog_post_deleted',
    ip: getClientIp(c.req.raw.headers),
    userAgent: c.req.header('User-Agent') ?? null,
    metadata: { postId: id },
  });
  return c.body(null, 204);
});

export default blog;
