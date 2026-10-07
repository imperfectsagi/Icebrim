import { Hono } from 'hono';
import type { Env } from '../lib/env';
import type { AuthedVariables } from '../middleware/auth';
import { requireAuth } from '../middleware/auth';
import { blogWriteSchema } from '../lib/schemas';
import { sanitizeBlogHtml } from '../lib/sanitize-html';
import { logAuditEvent, getClientIp } from '../lib/login-security';
import { applyRevalidatingCache, notModified } from '../lib/site-content';

const blog = new Hono<{ Bindings: Env }>();

type FeaturedMediaType = 'image' | 'video' | 'gif';

interface BlogRow {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content_html: string;
  featured_image_src: string;
  featured_image_alt: string;
  featured_media_type: FeaturedMediaType | null;
  featured_video_src: string | null;
  category: string;
  tags: string;
  author: string;
  status: 'draft' | 'published';
  published_at: string;
  seo_title: string;
  seo_description: string;
  updated_at: string;
}

function parseTags(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === 'string') : [];
  } catch {
    return [];
  }
}

function serializeBlog(row: BlogRow) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    contentHtml: row.content_html,
    featuredImage: { src: row.featured_image_src, alt: row.featured_image_alt },
    featuredMediaType: (row.featured_media_type ?? 'image') as FeaturedMediaType,
    featuredVideoSrc: row.featured_video_src ?? '',
    category: row.category,
    tags: parseTags(row.tags),
    author: row.author,
    status: row.status,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
    seo: { title: row.seo_title, description: row.seo_description },
  };
}

/** Tags are trimmed and de-duplicated case-insensitively, keeping the first spelling. */
function cleanTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const tag = raw.trim();
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out;
}

/** A post needs its featured media to match its chosen type. */
function featuredMediaError(type: FeaturedMediaType, imageSrc: string, videoSrc: string): string | null {
  if (type === 'video') return videoSrc.trim() ? null : 'Upload a featured video, or choose Image/GIF instead';
  return imageSrc.trim() ? null : `Add a featured ${type === 'gif' ? 'GIF' : 'image'}`;
}

function clampInt(value: string | undefined, min: number, max: number, fallback: number): number {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

// The public LIST omits the (large) article body: cards only need the
// summary fields, so a site with hundreds of posts stays fast. The full
// body is returned by the single-post endpoint below.
const LIST_COLUMNS = `id, slug, title, excerpt, '' AS content_html, featured_image_src, featured_image_alt,
  featured_media_type, featured_video_src, category, tags, author, status, published_at,
  seo_title, seo_description, updated_at`;

blog.get('/', async (c) => {
  const limit = clampInt(c.req.query('limit'), 1, 1000, 1000);
  const offset = clampInt(c.req.query('offset'), 0, 1_000_000, 0);

  // Cheap fingerprint of the published set (count + newest edit/creation):
  // any publish, unpublish, edit or delete changes it, so a visitor's
  // browser/the CDN revalidates and can never show a stale list after an
  // admin change. See lib/site-content.ts applyRevalidatingCache.
  const meta = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n, MAX(updated_at) AS u, MAX(created_at) AS cr FROM blog_posts WHERE status = 'published'`,
  ).first<{ n: number; u: string | null; cr: string | null }>();
  const version = `${meta?.n ?? 0}:${meta?.u ?? ''}:${meta?.cr ?? ''}:${limit}:${offset}`;
  const cached = notModified(c, version);
  if (cached) return cached;

  const { results } = await c.env.DB.prepare(
    `SELECT ${LIST_COLUMNS} FROM blog_posts WHERE status = 'published'
     ORDER BY published_at DESC, created_at DESC LIMIT ? OFFSET ?`,
  )
    .bind(limit, offset)
    .all<BlogRow>();

  applyRevalidatingCache(c, version);
  return c.json(results.map(serializeBlog));
});

blog.get('/:slug', async (c) => {
  const row = await c.env.DB.prepare(`SELECT * FROM blog_posts WHERE slug = ? AND status = 'published'`)
    .bind(c.req.param('slug'))
    .first<BlogRow>();
  if (!row) return c.json({ error: 'Post not found' }, 404);

  const cached = notModified(c, row.updated_at);
  if (cached) return cached;
  applyRevalidatingCache(c, row.updated_at);
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

  const mediaType: FeaturedMediaType = input.featuredMediaType ?? 'image';
  const videoSrc = mediaType === 'video' ? (input.featuredVideoSrc ?? '') : '';
  const mediaProblem = featuredMediaError(mediaType, input.featuredImage.src, videoSrc);
  if (mediaProblem) return c.json({ error: mediaProblem }, 400);

  const existingSlug = await c.env.DB.prepare('SELECT id FROM blog_posts WHERE slug = ?').bind(input.slug).first();
  if (existingSlug) return c.json({ error: 'A post with this URL slug already exists' }, 409);

  const id = `post_${crypto.randomUUID()}`;
  const cleanHtml = sanitizeBlogHtml(input.contentHtml);
  if (!cleanHtml) return c.json({ error: 'Content cannot be empty' }, 400);
  // The server stamps the publish time, so it is always the real moment.
  const publishedAt = input.publishedAt || new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO blog_posts (id, slug, title, excerpt, content_html, featured_image_src, featured_image_alt,
       featured_media_type, featured_video_src, category, tags, author, status, published_at, seo_title, seo_description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id, input.slug, input.title.trim(), input.excerpt.trim(), cleanHtml, input.featuredImage.src, input.featuredImage.alt.trim(),
      mediaType, videoSrc || null, input.category.trim(), JSON.stringify(cleanTags(input.tags)), input.author.trim(),
      input.status, publishedAt, input.seo.title.trim(), input.seo.description.trim(),
    )
    .run();

  await logAuditEvent(c.env.DB, {
    userId: c.get('userId'),
    action: 'blog_post_created',
    ip: getClientIp(c.req.raw.headers),
    userAgent: c.req.header('User-Agent') ?? null,
    metadata: { postId: id, slug: input.slug, status: input.status },
  });

  const row = await c.env.DB.prepare('SELECT * FROM blog_posts WHERE id = ?').bind(id).first<BlogRow>();
  return c.json(serializeBlog(row!), 201);
});

adminBlog.put('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => null);
  const parsed = blogWriteSchema.partial().safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid post data' }, 400);
  const input = parsed.data;

  const existing = await c.env.DB.prepare('SELECT * FROM blog_posts WHERE id = ?').bind(id).first<BlogRow>();
  if (!existing) return c.json({ error: 'Post not found' }, 404);

  if (input.slug !== undefined && input.slug !== existing.slug) {
    const clash = await c.env.DB.prepare('SELECT id FROM blog_posts WHERE slug = ? AND id != ?').bind(input.slug, id).first();
    if (clash) return c.json({ error: 'A post with this URL slug already exists' }, 409);
  }

  // Validate the media the post will have AFTER this update is applied.
  const nextType: FeaturedMediaType = input.featuredMediaType ?? existing.featured_media_type ?? 'image';
  const nextImage = input.featuredImage?.src ?? existing.featured_image_src;
  const nextVideo = nextType === 'video' ? (input.featuredVideoSrc ?? existing.featured_video_src ?? '') : '';
  const mediaProblem = featuredMediaError(nextType, nextImage, nextVideo);
  if (mediaProblem) return c.json({ error: mediaProblem }, 400);

  const fieldMap: Record<string, unknown> = {};
  if (input.title !== undefined) fieldMap.title = input.title.trim();
  if (input.slug !== undefined) fieldMap.slug = input.slug;
  if (input.excerpt !== undefined) fieldMap.excerpt = input.excerpt.trim();
  if (input.contentHtml !== undefined) {
    const clean = sanitizeBlogHtml(input.contentHtml);
    if (!clean) return c.json({ error: 'Content cannot be empty' }, 400);
    fieldMap.content_html = clean;
  }
  if (input.featuredImage?.src !== undefined) fieldMap.featured_image_src = input.featuredImage.src;
  if (input.featuredImage?.alt !== undefined) fieldMap.featured_image_alt = input.featuredImage.alt.trim();
  if (input.featuredMediaType !== undefined || input.featuredVideoSrc !== undefined) {
    fieldMap.featured_media_type = nextType;
    fieldMap.featured_video_src = nextVideo || null;
  }
  if (input.category !== undefined) fieldMap.category = input.category.trim();
  if (input.tags !== undefined) fieldMap.tags = JSON.stringify(cleanTags(input.tags));
  if (input.author !== undefined) fieldMap.author = input.author.trim();
  if (input.status !== undefined) {
    fieldMap.status = input.status;
    // Going from Draft to Published stamps the real publish time, so the
    // date readers see (and the order on the blog page) is when the post
    // actually went live, not when the draft was first started.
    if (input.status === 'published' && existing.status !== 'published') {
      fieldMap.published_at = new Date().toISOString();
    }
  }
  if (input.publishedAt !== undefined && fieldMap.published_at === undefined && input.status !== 'published') {
    fieldMap.published_at = input.publishedAt;
  }
  if (input.seo?.title !== undefined) fieldMap.seo_title = input.seo.title.trim();
  if (input.seo?.description !== undefined) fieldMap.seo_description = input.seo.description.trim();

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
    metadata: { postId: id, status: input.status },
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
