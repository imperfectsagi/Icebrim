import { Hono } from 'hono';
import type { Env } from '../lib/env';
import type { AuthedVariables } from '../middleware/auth';
import { requireAuth } from '../middleware/auth';
import { categoryWriteSchema } from '../lib/schemas';

// ---------------------------------------------------------------------------
// Categories (admin only -- used to organize products). Product categories
// are unrelated to the removed Gallery feature and every existing category
// row, product assignment, and endpoint here is unchanged.
// ---------------------------------------------------------------------------
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
