import { Hono } from 'hono';
import type { Env } from '../lib/env';
import type { AuthedVariables } from '../middleware/auth';
import { requireAuth } from '../middleware/auth';
import { productWriteSchema } from '../lib/schemas';
import { logAuditEvent, getClientIp } from '../lib/login-security';

const products = new Hono<{ Bindings: Env; Variables: Partial<AuthedVariables> }>();

interface ProductRow {
  id: string;
  slug: string;
  name: string;
  category: string;
  sku: string;
  price: number;
  offer_price: number | null;
  currency: string;
  stock: number;
  short_description: string;
  description: string;
  specs: string;
  seo_title: string;
  seo_description: string;
  published: number;
  rating_average: number;
  rating_count: number;
}

interface ImageRow {
  id: string;
  product_id: string;
  src: string;
  alt: string;
  sort_order: number;
}

function serializeProduct(row: ProductRow, images: ImageRow[]) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    sku: row.sku,
    price: row.price,
    offerPrice: row.offer_price ?? undefined,
    currency: row.currency,
    stock: row.stock,
    shortDescription: row.short_description,
    description: row.description,
    images: images.map((img) => ({ id: img.id, src: img.src, alt: img.alt })),
    specs: JSON.parse(row.specs),
    seo: { title: row.seo_title, description: row.seo_description },
    published: !!row.published,
    ratingAverage: row.rating_average,
    ratingCount: row.rating_count,
  };
}

async function fetchImagesFor(db: D1Database, productIds: string[]): Promise<Map<string, ImageRow[]>> {
  if (productIds.length === 0) return new Map();
  const placeholders = productIds.map(() => '?').join(',');
  const { results } = await db
    .prepare(`SELECT * FROM product_images WHERE product_id IN (${placeholders}) ORDER BY sort_order ASC`)
    .bind(...productIds)
    .all<ImageRow>();
  const map = new Map<string, ImageRow[]>();
  for (const img of results) {
    const list = map.get(img.product_id) ?? [];
    list.push(img);
    map.set(img.product_id, list);
  }
  return map;
}

products.get('/', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM products WHERE published = 1 ORDER BY created_at DESC').all<ProductRow>();
  const imagesByProduct = await fetchImagesFor(c.env.DB, results.map((r) => r.id));
  c.header('Cache-Control', 'public, max-age=60');
  return c.json(results.map((row) => serializeProduct(row, imagesByProduct.get(row.id) ?? [])));
});

products.get('/:slug', async (c) => {
  const slug = c.req.param('slug');
  const row = await c.env.DB.prepare('SELECT * FROM products WHERE slug = ? AND published = 1').bind(slug).first<ProductRow>();
  if (!row) return c.json({ error: 'Product not found' }, 404);
  const imagesByProduct = await fetchImagesFor(c.env.DB, [row.id]);
  c.header('Cache-Control', 'public, max-age=60');
  return c.json(serializeProduct(row, imagesByProduct.get(row.id) ?? []));
});

export const adminProducts = new Hono<{ Bindings: Env; Variables: AuthedVariables }>();
adminProducts.use('*', requireAuth);

adminProducts.get('/', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM products ORDER BY created_at DESC').all<ProductRow>();
  const imagesByProduct = await fetchImagesFor(c.env.DB, results.map((r) => r.id));
  return c.json(results.map((row) => serializeProduct(row, imagesByProduct.get(row.id) ?? [])));
});

adminProducts.post('/', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = productWriteSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid product data' }, 400);
  const input = parsed.data;

  const existingSlug = await c.env.DB.prepare('SELECT id FROM products WHERE slug = ?').bind(input.slug).first();
  if (existingSlug) return c.json({ error: 'A product with this URL slug already exists' }, 409);
  const existingSku = await c.env.DB.prepare('SELECT id FROM products WHERE sku = ?').bind(input.sku).first();
  if (existingSku) return c.json({ error: 'A product with this SKU already exists' }, 409);

  const id = `prod_${crypto.randomUUID()}`;

  await c.env.DB.prepare(
    `INSERT INTO products (id, slug, name, category, sku, price, offer_price, currency, stock,
       short_description, description, specs, seo_title, seo_description, published, rating_average, rating_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id, input.slug, input.name, input.category, input.sku, input.price, input.offerPrice ?? null,
      input.currency, input.stock, input.shortDescription, input.description, JSON.stringify(input.specs),
      input.seo.title, input.seo.description, input.published ? 1 : 0, input.ratingAverage, input.ratingCount,
    )
    .run();

  for (let i = 0; i < input.images.length; i++) {
    const img = input.images[i];
    await c.env.DB.prepare('INSERT INTO product_images (id, product_id, src, alt, sort_order) VALUES (?, ?, ?, ?, ?)')
      .bind(`img_${crypto.randomUUID()}`, id, img.src, img.alt, i)
      .run();
  }

  await logAuditEvent(c.env.DB, {
    userId: c.get('userId'),
    action: 'product_created',
    ip: getClientIp(c.req.raw.headers),
    userAgent: c.req.header('User-Agent') ?? null,
    metadata: { productId: id, slug: input.slug },
  });

  return c.json({ id, ...input }, 201);
});

adminProducts.put('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => null);
  const parsed = productWriteSchema.partial().safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid product data' }, 400);
  const input = parsed.data;

  const existing = await c.env.DB.prepare('SELECT id FROM products WHERE id = ?').bind(id).first();
  if (!existing) return c.json({ error: 'Product not found' }, 404);

  const fieldMap: Record<string, unknown> = {};
  if (input.name !== undefined) fieldMap.name = input.name;
  if (input.slug !== undefined) fieldMap.slug = input.slug;
  if (input.category !== undefined) fieldMap.category = input.category;
  if (input.sku !== undefined) fieldMap.sku = input.sku;
  if (input.price !== undefined) fieldMap.price = input.price;
  if (input.offerPrice !== undefined) fieldMap.offer_price = input.offerPrice;
  if (input.stock !== undefined) fieldMap.stock = input.stock;
  if (input.shortDescription !== undefined) fieldMap.short_description = input.shortDescription;
  if (input.description !== undefined) fieldMap.description = input.description;
  if (input.specs !== undefined) fieldMap.specs = JSON.stringify(input.specs);
  if (input.seo?.title !== undefined) fieldMap.seo_title = input.seo.title;
  if (input.seo?.description !== undefined) fieldMap.seo_description = input.seo.description;
  if (input.published !== undefined) fieldMap.published = input.published ? 1 : 0;

  if (Object.keys(fieldMap).length > 0) {
    const setClauses = Object.keys(fieldMap).map((k) => `${k} = ?`).join(', ');
    await c.env.DB.prepare(`UPDATE products SET ${setClauses}, updated_at = datetime('now') WHERE id = ?`)
      .bind(...Object.values(fieldMap), id)
      .run();
  }

  if (input.images) {
    await c.env.DB.prepare('DELETE FROM product_images WHERE product_id = ?').bind(id).run();
    for (let i = 0; i < input.images.length; i++) {
      const img = input.images[i];
      await c.env.DB.prepare('INSERT INTO product_images (id, product_id, src, alt, sort_order) VALUES (?, ?, ?, ?, ?)')
        .bind(img.id || `img_${crypto.randomUUID()}`, id, img.src, img.alt, i)
        .run();
    }
  }

  await logAuditEvent(c.env.DB, {
    userId: c.get('userId'),
    action: 'product_updated',
    ip: getClientIp(c.req.raw.headers),
    userAgent: c.req.header('User-Agent') ?? null,
    metadata: { productId: id },
  });

  const row = await c.env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first<ProductRow>();
  const imagesByProduct = await fetchImagesFor(c.env.DB, [id]);
  return c.json(serializeProduct(row!, imagesByProduct.get(id) ?? []));
});

adminProducts.delete('/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM products WHERE id = ?').bind(id).run();
  await logAuditEvent(c.env.DB, {
    userId: c.get('userId'),
    action: 'product_deleted',
    ip: getClientIp(c.req.raw.headers),
    userAgent: c.req.header('User-Agent') ?? null,
    metadata: { productId: id },
  });
  return c.body(null, 204);
});

export default products;
