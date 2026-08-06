import { Hono } from 'hono';
import type { Env } from '../lib/env';
import type { AuthedVariables } from '../middleware/auth';
import { requireAuth } from '../middleware/auth';
import {
  categoryWriteSchema,
  galleryImageWriteSchema,
  galleryImagePatchSchema,
  galleryReorderSchema,
} from '../lib/schemas';
import { logAuditEvent, getClientIp } from '../lib/login-security';

interface GalleryImageRow {
  id: string;
  src: string;
  alt: string;
  caption: string | null;
  category: string | null;
  sort_order: number;
  created_at: string;
  media_type: string | null;
  video_src: string | null;
}

function serializeGalleryImage(r: GalleryImageRow) {
  return {
    id: r.id,
    src: r.src,
    alt: r.alt,
    caption: r.caption ?? undefined,
    category: r.category ?? undefined,
    sortOrder: r.sort_order,
    mediaType: (r.media_type ?? 'image') as 'image' | 'video' | 'gif',
    videoSrc: r.video_src ?? undefined,
  };
}

export const adminCategories = new Hono<{ Bindings: Env; Variables: AuthedVariables }>();
adminCategories.use('*', requireAuth);

adminCategories.get('/', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM categories ORDER BY name ASC').all();
  return c.json(results.map((r) => ({ id: r.id, name: r.name, slug: r.slug })));
});

adminCategories.post('/', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = categoryWriteSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid category' }, 400);

  const existing = await c.env.DB.prepare('SELECT id FROM categories WHERE slug = ?').bind(parsed.data.slug).first();
  if (existing) return c.json({ error: 'A category with this slug already exists' }, 409);

  const id = `cat_${crypto.randomUUID()}`;
  await c.env.DB.prepare('INSERT INTO categories (id, name, slug) VALUES (?, ?, ?)')
    .bind(id, parsed.data.name, parsed.data.slug)
    .run();

  return c.json({ id, ...parsed.data }, 201);
});

adminCategories.delete('/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM categories WHERE id = ?').bind(c.req.param('id')).run();
  return c.body(null, 204);
});

// ---------------------------------------------------------------------------
// Gallery (public read, admin write)
// ---------------------------------------------------------------------------
export const gallery = new Hono<{ Bindings: Env }>();

gallery.get('/', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM gallery_images ORDER BY sort_order ASC').all<GalleryImageRow>();
  c.header('Cache-Control', 'public, max-age=300');
  return c.json(results.map(serializeGalleryImage));
});

export const adminGallery = new Hono<{ Bindings: Env; Variables: AuthedVariables }>();
adminGallery.use('*', requireAuth);

// Admin listing includes every image regardless of category, ordered the
// same way the public gallery renders them, so the admin UI's ordering
// always matches what visitors see.
adminGallery.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM gallery_images ORDER BY sort_order ASC, created_at DESC',
  ).all<GalleryImageRow>();
  return c.json(results.map(serializeGalleryImage));
});

adminGallery.post('/', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = galleryImageWriteSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid gallery image' }, 400);
  }

  // New images go to the end of the current order.
  const maxRow = await c.env.DB.prepare(
    'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM gallery_images',
  ).first<{ max_order: number }>();
  const sortOrder = (maxRow?.max_order ?? -1) + 1;

  const id = `gal_${crypto.randomUUID()}`;
  await c.env.DB.prepare(
    'INSERT INTO gallery_images (id, src, alt, caption, category, sort_order, media_type, video_src) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(
      id,
      parsed.data.src,
      parsed.data.alt,
      parsed.data.caption ?? null,
      parsed.data.category ?? null,
      sortOrder,
      parsed.data.mediaType ?? 'image',
      parsed.data.videoSrc ?? null,
    )
    .run();

  await logAuditEvent(c.env.DB, {
    userId: c.get('userId'),
    action: 'gallery_image_created',
    ip: getClientIp(c.req.raw.headers),
    userAgent: c.req.header('User-Agent') ?? null,
    metadata: { galleryImageId: id },
  });

  const row = await c.env.DB.prepare('SELECT * FROM gallery_images WHERE id = ?').bind(id).first<GalleryImageRow>();
  return c.json(serializeGalleryImage(row!), 201);
});

// Edit an existing gallery image: swap the image itself, change alt text,
// caption, or category. This is the endpoint that was previously missing
// entirely -- gallery images could only be created or deleted, never edited.
adminGallery.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => null);
  const parsed = galleryImagePatchSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid gallery image update' }, 400);
  }

  const existing = await c.env.DB.prepare('SELECT * FROM gallery_images WHERE id = ?').bind(id).first<GalleryImageRow>();
  if (!existing) return c.json({ error: 'Gallery image not found' }, 404);

  const next = {
    src: parsed.data.src ?? existing.src,
    alt: parsed.data.alt ?? existing.alt,
    caption: parsed.data.caption === undefined ? existing.caption : parsed.data.caption,
    category: parsed.data.category === undefined ? existing.category : parsed.data.category,
    mediaType: parsed.data.mediaType ?? existing.media_type ?? 'image',
    videoSrc: parsed.data.videoSrc === undefined ? existing.video_src : parsed.data.videoSrc,
  };

  await c.env.DB.prepare(
    'UPDATE gallery_images SET src = ?, alt = ?, caption = ?, category = ?, media_type = ?, video_src = ? WHERE id = ?',
  )
    .bind(next.src, next.alt, next.caption, next.category, next.mediaType, next.videoSrc, id)
    .run();

  await logAuditEvent(c.env.DB, {
    userId: c.get('userId'),
    action: 'gallery_image_updated',
    ip: getClientIp(c.req.raw.headers),
    userAgent: c.req.header('User-Agent') ?? null,
    metadata: { galleryImageId: id },
  });

  const updated = await c.env.DB.prepare('SELECT * FROM gallery_images WHERE id = ?').bind(id).first<GalleryImageRow>();
  return c.json(serializeGalleryImage(updated!));
});

// Reorder: accepts the full desired ID order and rewrites sort_order to
// match, so drag-and-drop reordering in the admin UI persists.
adminGallery.put('/reorder', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = galleryReorderSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid reorder payload' }, 400);

  const statements = parsed.data.orderedIds.map((id, index) =>
    c.env.DB.prepare('UPDATE gallery_images SET sort_order = ? WHERE id = ?').bind(index, id),
  );
  await c.env.DB.batch(statements);

  const { results } = await c.env.DB.prepare(
    'SELECT * FROM gallery_images ORDER BY sort_order ASC, created_at DESC',
  ).all<GalleryImageRow>();
  return c.json(results.map(serializeGalleryImage));
});

adminGallery.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const existing = await c.env.DB.prepare('SELECT id FROM gallery_images WHERE id = ?').bind(id).first();
  if (!existing) return c.json({ error: 'Gallery image not found' }, 404);

  await c.env.DB.prepare('DELETE FROM gallery_images WHERE id = ?').bind(id).run();

  await logAuditEvent(c.env.DB, {
    userId: c.get('userId'),
    action: 'gallery_image_deleted',
    ip: getClientIp(c.req.raw.headers),
    userAgent: c.req.header('User-Agent') ?? null,
    metadata: { galleryImageId: id },
  });

  return c.body(null, 204);
});
