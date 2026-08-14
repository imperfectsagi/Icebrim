import { Hono } from 'hono';
import type { Env } from '../lib/env';
import type { AuthedVariables } from '../middleware/auth';
import { requireAuth } from '../middleware/auth';
import { couponWriteSchema } from '../lib/schemas';
import { normalizeCouponCode, type CouponRow } from '../lib/coupons';
import { toMinorUnits, toDecimal } from '../lib/money';
import { logAuditEvent, getClientIp } from '../lib/login-security';

// Same access level as adminOrders/adminGallery/adminContent -- both
// 'admin' and 'editor' roles can manage coupons; requireAdminRole (owner
// only) is reserved for user management, theme, and system settings, not
// day-to-day content/commerce operations (see middleware/auth.ts).
export const adminCoupons = new Hono<{ Bindings: Env; Variables: AuthedVariables }>();
adminCoupons.use('*', requireAuth);

// discount_value is stored as a whole-number percentage (1-100) for
// 'percentage' coupons, but as integer minor units (pence) for 'fixed'
// coupons -- same convention as min_order_subtotal_minor (see
// migration 0007_coupons.sql and lib/coupons.ts). The admin form and the
// public-facing serialized Coupon type both work in decimal pounds for
// 'fixed' discounts, so conversion has to happen at this boundary,
// exactly like toMinorUnits/toDecimal is already applied to
// minOrderSubtotal a few lines below.
function toStoredDiscountValue(discountType: 'percentage' | 'fixed', discountValue: number): number {
  return discountType === 'fixed' ? toMinorUnits(discountValue) : discountValue;
}

function serializeCoupon(row: CouponRow & { created_at: string; updated_at: string }) {
  return {
    id: row.id,
    code: row.code,
    discountType: row.discount_type,
    discountValue: row.discount_type === 'fixed' ? toDecimal(row.discount_value) : row.discount_value,
    active: !!row.active,
    expiresAt: row.expires_at,
    usageLimit: row.usage_limit,
    usedCount: row.used_count,
    minOrderSubtotal: row.min_order_subtotal_minor === null ? null : toDecimal(row.min_order_subtotal_minor),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

adminCoupons.get('/', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM coupons ORDER BY created_at DESC').all<
    CouponRow & { created_at: string; updated_at: string }
  >();
  return c.json(results.map(serializeCoupon));
});

adminCoupons.post('/', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = couponWriteSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid coupon' }, 400);
  const input = parsed.data;

  const code = normalizeCouponCode(input.code);
  const existing = await c.env.DB.prepare('SELECT id FROM coupons WHERE code = ?').bind(code).first();
  if (existing) return c.json({ error: 'A coupon with this code already exists' }, 409);

  const id = `cpn_${crypto.randomUUID()}`;
  await c.env.DB.prepare(
    `INSERT INTO coupons (id, code, discount_type, discount_value, active, expires_at, usage_limit, min_order_subtotal_minor)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      code,
      input.discountType,
      toStoredDiscountValue(input.discountType, input.discountValue),
      input.active ? 1 : 0,
      input.expiresAt ?? null,
      input.usageLimit ?? null,
      input.minOrderSubtotal == null ? null : toMinorUnits(input.minOrderSubtotal),
    )
    .run();

  await logAuditEvent(c.env.DB, {
    userId: c.get('userId'),
    action: 'coupon_created',
    ip: getClientIp(c.req.raw.headers),
    userAgent: c.req.header('User-Agent') ?? null,
    metadata: { couponId: id, code },
  });

  const row = await c.env.DB.prepare('SELECT * FROM coupons WHERE id = ?').bind(id).first<
    CouponRow & { created_at: string; updated_at: string }
  >();
  return c.json(serializeCoupon(row!), 201);
});

adminCoupons.put('/:id', async (c) => {
  const id = c.req.param('id');
  const existing = await c.env.DB.prepare('SELECT * FROM coupons WHERE id = ?').bind(id).first<CouponRow>();
  if (!existing) return c.json({ error: 'Coupon not found' }, 404);

  const body = await c.req.json().catch(() => null);
  const parsed = couponWriteSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid coupon' }, 400);
  const input = parsed.data;

  const code = normalizeCouponCode(input.code);
  if (code !== existing.code) {
    const codeTaken = await c.env.DB.prepare('SELECT id FROM coupons WHERE code = ? AND id != ?').bind(code, id).first();
    if (codeTaken) return c.json({ error: 'A coupon with this code already exists' }, 409);
  }

  await c.env.DB.prepare(
    `UPDATE coupons
     SET code = ?, discount_type = ?, discount_value = ?, active = ?, expires_at = ?, usage_limit = ?, min_order_subtotal_minor = ?, updated_at = datetime('now')
     WHERE id = ?`,
  )
    .bind(
      code,
      input.discountType,
      toStoredDiscountValue(input.discountType, input.discountValue),
      input.active ? 1 : 0,
      input.expiresAt ?? null,
      input.usageLimit ?? null,
      input.minOrderSubtotal == null ? null : toMinorUnits(input.minOrderSubtotal),
      id,
    )
    .run();

  await logAuditEvent(c.env.DB, {
    userId: c.get('userId'),
    action: 'coupon_updated',
    ip: getClientIp(c.req.raw.headers),
    userAgent: c.req.header('User-Agent') ?? null,
    metadata: { couponId: id, code },
  });

  const row = await c.env.DB.prepare('SELECT * FROM coupons WHERE id = ?').bind(id).first<
    CouponRow & { created_at: string; updated_at: string }
  >();
  return c.json(serializeCoupon(row!));
});

adminCoupons.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const existing = await c.env.DB.prepare('SELECT id FROM coupons WHERE id = ?').bind(id).first();
  if (!existing) return c.json({ error: 'Coupon not found' }, 404);

  // Orders that already used this coupon keep their coupon_code snapshot
  // and discount_minor value (see migration 0007_coupons.sql) -- deleting
  // the coupon itself is safe and doesn't alter order history.
  await c.env.DB.prepare('DELETE FROM coupons WHERE id = ?').bind(id).run();

  await logAuditEvent(c.env.DB, {
    userId: c.get('userId'),
    action: 'coupon_deleted',
    ip: getClientIp(c.req.raw.headers),
    userAgent: c.req.header('User-Agent') ?? null,
    metadata: { couponId: id },
  });

  return c.body(null, 204);
});

export default adminCoupons;
