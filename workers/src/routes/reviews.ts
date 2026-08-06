import { Hono } from 'hono';
import type { Env } from '../lib/env';
import type { AuthedVariables } from '../middleware/auth';
import { requireAuth } from '../middleware/auth';
import { reviewSubmitSchema, reviewModerateSchema, reviewEditSchema } from '../lib/schemas';
import { logAuditEvent, getClientIp } from '../lib/login-security';

const reviews = new Hono<{ Bindings: Env }>();

interface ReviewRow {
  id: string;
  product_slug: string;
  author_name: string;
  location: string | null;
  rating: number;
  title: string;
  body: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

function serializeReview(row: ReviewRow) {
  return {
    id: row.id,
    productSlug: row.product_slug,
    authorName: row.author_name,
    location: row.location ?? undefined,
    rating: row.rating,
    title: row.title,
    body: row.body,
    status: row.status,
    createdAt: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// Public: list approved reviews, optionally filtered by product
// ---------------------------------------------------------------------------
reviews.get('/', async (c) => {
  const productSlug = c.req.query('product');
  const query = productSlug
    ? c.env.DB.prepare(`SELECT * FROM reviews WHERE status = 'approved' AND product_slug = ? ORDER BY created_at DESC`).bind(productSlug)
    : c.env.DB.prepare(`SELECT * FROM reviews WHERE status = 'approved' ORDER BY created_at DESC LIMIT 50`);
  const { results } = await query.all<ReviewRow>();
  c.header('Cache-Control', 'public, max-age=60');
  return c.json(results.map(serializeReview));
});

// ---------------------------------------------------------------------------
// Public: submit a review (pending moderation)
// ---------------------------------------------------------------------------
reviews.post('/', async (c) => {
  const ip = getClientIp(c.req.raw.headers);

  // Rate limit review submissions per IP to blunt spam/abuse floods.
  const rateLimitResult = await c.env.FORM_RATE_LIMITER.limit({ key: `review:${ip}` });
  if (!rateLimitResult.success) {
    return c.json({ error: 'Too many submissions. Please try again later.' }, 429);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = reviewSubmitSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid review data' }, 400);
  const input = parsed.data;

  // Honeypot: a filled hidden field means a bot filled every input.
  // Silently accept-and-drop rather than returning an error, so bots
  // don't learn their submission was detected and adjust.
  if (input.companyWebsite) {
    return c.json({ success: true }, 201);
  }

  const id = `rev_${crypto.randomUUID()}`;
  await c.env.DB.prepare(
    `INSERT INTO reviews (id, product_slug, author_name, location, rating, title, body, status, ip_address)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
  )
    .bind(id, input.productSlug, input.authorName, input.location ?? null, input.rating, input.title, input.body, ip)
    .run();

  return c.json({ success: true, id }, 201);
});

// ---------------------------------------------------------------------------
// Admin: list all reviews (any status), moderate, delete
// ---------------------------------------------------------------------------
export const adminReviews = new Hono<{ Bindings: Env; Variables: AuthedVariables }>();
adminReviews.use('*', requireAuth);

adminReviews.get('/', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM reviews ORDER BY created_at DESC').all<ReviewRow>();
  return c.json(results.map(serializeReview));
});

adminReviews.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => null);
  const parsed = reviewModerateSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid status' }, 400);

  const existing = await c.env.DB.prepare('SELECT * FROM reviews WHERE id = ?').bind(id).first<ReviewRow>();
  if (!existing) return c.json({ error: 'Review not found' }, 404);

  await c.env.DB.prepare('UPDATE reviews SET status = ? WHERE id = ?').bind(parsed.data.status, id).run();

  // Recompute the product's aggregate rating whenever moderation status
  // changes, since only approved reviews should count toward it.
  if (parsed.data.status === 'approved' || existing.status === 'approved') {
    await recomputeProductRating(c.env.DB, existing.product_slug);
  }

  await logAuditEvent(c.env.DB, {
    userId: c.get('userId'),
    action: 'review_moderated',
    ip: getClientIp(c.req.raw.headers),
    userAgent: c.req.header('User-Agent') ?? null,
    metadata: { reviewId: id, status: parsed.data.status },
  });

  const updated = await c.env.DB.prepare('SELECT * FROM reviews WHERE id = ?').bind(id).first<ReviewRow>();
  return c.json(serializeReview(updated!));
});

// Edit a review's actual content -- author name, location, star rating,
// title, or body. Previously the only admin action available was
// approve/reject/delete via PATCH :id (status only); this is the missing
// "edit the rating / edit the review" capability, kept as a separate PUT
// so the existing status-only PATCH endpoint above is untouched.
adminReviews.put('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => null);
  const parsed = reviewEditSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid review edit' }, 400);
  }

  const existing = await c.env.DB.prepare('SELECT * FROM reviews WHERE id = ?').bind(id).first<ReviewRow>();
  if (!existing) return c.json({ error: 'Review not found' }, 404);

  const next = {
    authorName: parsed.data.authorName ?? existing.author_name,
    location: parsed.data.location === undefined ? existing.location : parsed.data.location,
    rating: parsed.data.rating ?? existing.rating,
    title: parsed.data.title ?? existing.title,
    body: parsed.data.body ?? existing.body,
  };

  await c.env.DB.prepare(
    'UPDATE reviews SET author_name = ?, location = ?, rating = ?, title = ?, body = ? WHERE id = ?',
  )
    .bind(next.authorName, next.location, next.rating, next.title, next.body, id)
    .run();

  // The star rating may have changed -- recompute the product's aggregate
  // rating if this review currently counts toward it.
  if (existing.status === 'approved') {
    await recomputeProductRating(c.env.DB, existing.product_slug);
  }

  await logAuditEvent(c.env.DB, {
    userId: c.get('userId'),
    action: 'review_edited',
    ip: getClientIp(c.req.raw.headers),
    userAgent: c.req.header('User-Agent') ?? null,
    metadata: { reviewId: id },
  });

  const updated = await c.env.DB.prepare('SELECT * FROM reviews WHERE id = ?').bind(id).first<ReviewRow>();
  return c.json(serializeReview(updated!));
});

adminReviews.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const existing = await c.env.DB.prepare('SELECT product_slug FROM reviews WHERE id = ?').bind(id).first<{ product_slug: string }>();
  await c.env.DB.prepare('DELETE FROM reviews WHERE id = ?').bind(id).run();
  if (existing) await recomputeProductRating(c.env.DB, existing.product_slug);

  await logAuditEvent(c.env.DB, {
    userId: c.get('userId'),
    action: 'review_deleted',
    ip: getClientIp(c.req.raw.headers),
    userAgent: c.req.header('User-Agent') ?? null,
    metadata: { reviewId: id },
  });

  return c.body(null, 204);
});

async function recomputeProductRating(db: D1Database, productSlug: string): Promise<void> {
  const agg = await db
    .prepare(`SELECT AVG(rating) as avg_rating, COUNT(*) as count FROM reviews WHERE product_slug = ? AND status = 'approved'`)
    .bind(productSlug)
    .first<{ avg_rating: number | null; count: number }>();

  await db
    .prepare('UPDATE products SET rating_average = ?, rating_count = ? WHERE slug = ?')
    .bind(agg?.avg_rating ?? 0, agg?.count ?? 0, productSlug)
    .run();
}

export default reviews;
