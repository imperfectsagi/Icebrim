import { Hono } from 'hono';
import type { Env } from '../lib/env';
import type { AuthedVariables } from '../middleware/auth';
import { requireAuth } from '../middleware/auth';
import { checkoutCreateSchema, orderStatusUpdateSchema, couponPreviewSchema } from '../lib/schemas';
import { toMinorUnits, toDecimal, generateOrderNumber } from '../lib/money';
import { normalizeCouponCode, validateCoupon, couponErrorMessage, type CouponRow } from '../lib/coupons';
import { logAuditEvent, getClientIp } from '../lib/login-security';
import { logPaymentError } from '../lib/error-log';
import { createPaymentIntent } from '../lib/payments';
import { sendOrderConfirmationEmail } from '../lib/email';

const orders = new Hono<{ Bindings: Env; Variables: Partial<AuthedVariables> }>();

// Stock reservations on a pending order expire after this long. Chosen to
// comfortably exceed a normal checkout (fill address, redirect to
// Stripe/Razorpay, pay, redirect back) while not holding stock hostage for
// long if someone abandons checkout. See releaseExpiredReservations below.
const RESERVATION_MINUTES = 20;

interface OrderRow {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  shipping_line1: string;
  shipping_line2: string | null;
  shipping_city: string;
  shipping_postal_code: string;
  shipping_country: string;
  currency: string;
  subtotal_minor: number;
  shipping_minor: number;
  discount_minor: number;
  total_minor: number;
  status: string;
  payment_provider: string | null;
  payment_intent_id: string | null;
  payment_reference: string | null;
  paid_at: string | null;
  tracking_number: string | null;
  tracking_carrier: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  customer_note: string | null;
  admin_note: string | null;
  coupon_id: string | null;
  coupon_code: string | null;
  created_at: string;
  updated_at: string;
}

interface OrderItemRow {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  product_sku: string;
  product_image: string | null;
  unit_price_minor: number;
  quantity: number;
  line_total_minor: number;
}

/** Serializes an order for the ADMIN API -- includes admin_note and full internal fields. */
function serializeOrderAdmin(row: OrderRow, items: OrderItemRow[]) {
  return {
    id: row.id,
    orderNumber: row.order_number,
    customer: {
      name: row.customer_name,
      email: row.customer_email,
      phone: row.customer_phone ?? undefined,
    },
    shipping: {
      line1: row.shipping_line1,
      line2: row.shipping_line2 ?? undefined,
      city: row.shipping_city,
      postalCode: row.shipping_postal_code,
      country: row.shipping_country,
    },
    currency: row.currency,
    subtotal: toDecimal(row.subtotal_minor),
    shippingCost: toDecimal(row.shipping_minor),
    discount: toDecimal(row.discount_minor),
    couponCode: row.coupon_code ?? undefined,
    total: toDecimal(row.total_minor),
    status: row.status,
    paymentProvider: row.payment_provider ?? undefined,
    paymentReference: row.payment_reference ?? undefined,
    paidAt: row.paid_at ?? undefined,
    tracking: row.tracking_number
      ? { number: row.tracking_number, carrier: row.tracking_carrier ?? undefined }
      : undefined,
    shippedAt: row.shipped_at ?? undefined,
    deliveredAt: row.delivered_at ?? undefined,
    customerNote: row.customer_note ?? undefined,
    adminNote: row.admin_note ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: items.map((i) => ({
      id: i.id,
      productId: i.product_id ?? undefined,
      name: i.product_name,
      sku: i.product_sku,
      image: i.product_image ?? undefined,
      unitPrice: toDecimal(i.unit_price_minor),
      quantity: i.quantity,
      lineTotal: toDecimal(i.line_total_minor),
    })),
  };
}

/** Serializes an order for the PUBLIC order-status-lookup endpoint -- omits admin_note and payment provider internals. */
function serializeOrderPublic(row: OrderRow, items: OrderItemRow[]) {
  const full = serializeOrderAdmin(row, items);
  const { adminNote: _adminNote, paymentProvider: _paymentProvider, ...publicSafe } = full;
  return publicSafe;
}

async function fetchOrderItems(db: D1Database, orderId: string): Promise<OrderItemRow[]> {
  const { results } = await db
    .prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY created_at ASC')
    .bind(orderId)
    .all<OrderItemRow>();
  return results;
}

/**
 * Releases stock reservations for pending orders whose reservation window
 * has expired without payment confirming. Called opportunistically at the
 * top of checkout creation (cheap, keeps stock numbers accurate for the
 * customer currently checking out) AND via a scheduled Worker cron trigger
 * (see workers/src/scheduled.ts + wrangler.toml [triggers]) so it also
 * runs when nobody happens to be checking out.
 */
export async function releaseExpiredReservations(db: D1Database): Promise<number> {
  const { results: expired } = await db
    .prepare(
      `SELECT id FROM orders WHERE status = 'pending_payment' AND stock_reserved_until IS NOT NULL AND stock_reserved_until < datetime('now')`,
    )
    .all<{ id: string }>();

  for (const { id } of expired) {
    const items = await fetchOrderItems(db, id);
    const statements = items
      .filter((i) => i.product_id)
      .map((i) => db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').bind(i.quantity, i.product_id));
    statements.push(
      db
        .prepare(`UPDATE orders SET status = 'cancelled', updated_at = datetime('now') WHERE id = ? AND status = 'pending_payment'`)
        .bind(id),
    );
    statements.push(
      db
        .prepare(
          `INSERT INTO order_status_history (id, order_id, status, note) VALUES (?, ?, 'cancelled', 'Stock reservation expired -- payment not completed in time')`,
        )
        .bind(`oshist_${crypto.randomUUID()}`, id),
    );
    await db.batch(statements);
  }

  return expired.length;
}

// ---------------------------------------------------------------------------
// Public: checkout
// ---------------------------------------------------------------------------

/**
 * Creates a pending order and reserves stock. Every price is re-read from
 * the products table -- the client only sends productId + quantity, never
 * a price (see checkoutCreateSchema). This is the only defense against a
 * tampered client sending a fake discounted price; trusting client-sent
 * prices would let anyone check out for £0.01.
 */
// Read-only preview: lets the checkout page show a discount amount
// before the customer finishes filling out shipping/payment details,
// without creating an order. Recomputes the subtotal from current
// product prices the exact same way /checkout does (never trusts a
// client-sent subtotal), so the number shown here always matches what
// /checkout would actually apply. Rate-limited the same way as checkout
// to prevent using this as a coupon-code-guessing oracle.
orders.post('/validate-coupon', async (c) => {
  const ip = getClientIp(c.req.raw.headers);
  const rateLimitResult = await c.env.FORM_RATE_LIMITER.limit({ key: `coupon-check:${ip}` });
  if (!rateLimitResult.success) {
    return c.json({ error: 'Too many attempts. Please wait a moment and try again.' }, 429);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = couponPreviewSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, 400);
  const input = parsed.data;

  const quantitiesByProduct = new Map<string, number>();
  for (const item of input.items) {
    quantitiesByProduct.set(item.productId, (quantitiesByProduct.get(item.productId) ?? 0) + item.quantity);
  }
  const productIds = [...quantitiesByProduct.keys()];
  const placeholders = productIds.map(() => '?').join(',');
  const { results: products } = await c.env.DB.prepare(
    `SELECT id, price, offer_price FROM products WHERE id IN (${placeholders}) AND published = 1`,
  )
    .bind(...productIds)
    .all<{ id: string; price: number; offer_price: number | null }>();
  const productById = new Map(products.map((p) => [p.id, p]));

  let subtotalMinor = 0;
  for (const [productId, quantity] of quantitiesByProduct) {
    const product = productById.get(productId);
    if (!product) continue; // stale/removed item -- excluded from the preview subtotal, same as it would be rejected at actual checkout
    const effectivePrice = product.offer_price != null && product.offer_price < product.price ? product.offer_price : product.price;
    subtotalMinor += toMinorUnits(effectivePrice) * quantity;
  }

  const normalizedCode = normalizeCouponCode(input.couponCode);
  const couponRow = await c.env.DB.prepare('SELECT * FROM coupons WHERE code = ?').bind(normalizedCode).first<CouponRow>();
  const result = validateCoupon(couponRow, subtotalMinor);
  if (!result.valid) {
    return c.json({ error: couponErrorMessage(result.reason) }, 400);
  }

  return c.json({ discount: toDecimal(result.discountMinor), code: couponRow!.code });
});

orders.post('/checkout', async (c) => {
  const ip = getClientIp(c.req.raw.headers);
  const rateLimitResult = await c.env.FORM_RATE_LIMITER.limit({ key: `checkout:${ip}` });
  if (!rateLimitResult.success) {
    return c.json({ error: 'Too many checkout attempts. Please wait a moment and try again.' }, 429);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = checkoutCreateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid checkout data' }, 400);
  }
  const input = parsed.data;

  // Best-effort cleanup so stock numbers are fresh for THIS checkout too.
  // Not blocking-critical -- if it fails, the stock check below still
  // protects against overselling.
  await releaseExpiredReservations(c.env.DB).catch(() => {});

  // Deduplicate line items referencing the same product (defensive -- the
  // cart UI shouldn't produce duplicates, but never trust the client).
  const quantitiesByProduct = new Map<string, number>();
  for (const item of input.items) {
    quantitiesByProduct.set(item.productId, (quantitiesByProduct.get(item.productId) ?? 0) + item.quantity);
  }

  const productIds = [...quantitiesByProduct.keys()];
  const placeholders = productIds.map(() => '?').join(',');
  const { results: products } = await c.env.DB.prepare(
    `SELECT id, slug, name, sku, price, offer_price, currency, stock, published FROM products WHERE id IN (${placeholders})`,
  )
    .bind(...productIds)
    .all<{
      id: string;
      slug: string;
      name: string;
      sku: string;
      price: number;
      offer_price: number | null;
      currency: string;
      stock: number;
      published: number;
    }>();

  const productById = new Map(products.map((p) => [p.id, p]));

  // Validate every requested product exists, is published, and has enough
  // stock -- BEFORE writing anything, so a failed checkout never partially
  // reserves stock for some items and not others.
  for (const [productId, quantity] of quantitiesByProduct) {
    const product = productById.get(productId);
    if (!product || !product.published) {
      return c.json(
        {
          error: 'One of the items in your cart is no longer available. Please refresh your cart.',
          productId,
          availableStock: 0,
        },
        409,
      );
    }
    if (product.stock < quantity) {
      return c.json(
        {
          error: `Sorry, only ${product.stock} of "${product.name}" left in stock. Please update your cart.`,
          productId,
          availableStock: product.stock,
        },
        409,
      );
    }
  }

  // Fetch a representative image per product for the order-item snapshot.
  const imagesResult = await c.env.DB.prepare(
    `SELECT product_id, src FROM product_images WHERE product_id IN (${placeholders}) ORDER BY sort_order ASC`,
  )
    .bind(...productIds)
    .all<{ product_id: string; src: string }>();
  const firstImageByProduct = new Map<string, string>();
  for (const row of imagesResult.results) {
    if (!firstImageByProduct.has(row.product_id)) firstImageByProduct.set(row.product_id, row.src);
  }

  const orderId = `ord_${crypto.randomUUID()}`;
  const orderNumber = generateOrderNumber();
  const currency = products[0]?.currency ?? 'GBP';

  let subtotalMinor = 0;
  const itemInserts: {
    id: string;
    productId: string;
    name: string;
    sku: string;
    image: string | null;
    unitPriceMinor: number;
    quantity: number;
    lineTotalMinor: number;
  }[] = [];

  for (const [productId, quantity] of quantitiesByProduct) {
    const product = productById.get(productId)!;
    // Effective price = offer price if set and lower, otherwise list price
    // -- mirrors how the product detail page displays price (see
    // ProductDetailPage.tsx), so what the customer saw is what they pay.
    const effectivePrice =
      product.offer_price != null && product.offer_price < product.price ? product.offer_price : product.price;
    const unitPriceMinor = toMinorUnits(effectivePrice);
    const lineTotalMinor = unitPriceMinor * quantity;
    subtotalMinor += lineTotalMinor;

    itemInserts.push({
      id: `oitem_${crypto.randomUUID()}`,
      productId,
      name: product.name,
      sku: product.sku,
      image: firstImageByProduct.get(productId) ?? null,
      unitPriceMinor,
      quantity,
      lineTotalMinor,
    });
  }

  // Flat shipping rate with a free-shipping threshold. A future iteration
  // could make this configurable via admin settings or computed from
  // weight/destination; kept simple and explicit here since the repair
  // plan doesn't specify shipping-rate rules and those vary a lot by
  // business.
  const FREE_SHIPPING_THRESHOLD_MINOR = toMinorUnits(70);
  const FLAT_SHIPPING_MINOR = toMinorUnits(4.99);
  const shippingMinor = subtotalMinor >= FREE_SHIPPING_THRESHOLD_MINOR ? 0 : FLAT_SHIPPING_MINOR;

  // Coupon: validated and priced server-side from the DB row, never from
  // anything the client sent about the discount itself -- the client only
  // supplies a code string. See lib/coupons.ts for why this is the only
  // place that logic lives. A coupon discounts the subtotal, not
  // shipping (matches orders.total_minor's documented formula: subtotal +
  // shipping - discount -- see migration 0004_orders_schema.sql).
  let discountMinor = 0;
  let appliedCoupon: { id: string; code: string } | null = null;
  if (input.couponCode) {
    const normalizedCode = normalizeCouponCode(input.couponCode);
    const couponRow = await c.env.DB.prepare('SELECT * FROM coupons WHERE code = ?').bind(normalizedCode).first<CouponRow>();
    const result = validateCoupon(couponRow, subtotalMinor);
    if (!result.valid) {
      return c.json({ error: couponErrorMessage(result.reason) }, 400);
    }
    discountMinor = result.discountMinor;
    appliedCoupon = { id: couponRow!.id, code: couponRow!.code };
  }

  const totalMinor = subtotalMinor + shippingMinor - discountMinor;

  const reservedUntil = new Date(Date.now() + RESERVATION_MINUTES * 60 * 1000).toISOString();

  const statements = [
    c.env.DB.prepare(
      `INSERT INTO orders (
        id, order_number, customer_name, customer_email, customer_phone,
        shipping_line1, shipping_line2, shipping_city, shipping_postal_code, shipping_country,
        currency, subtotal_minor, shipping_minor, discount_minor, total_minor,
        status, payment_provider, customer_note, stock_reserved_until, coupon_id, coupon_code
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_payment', ?, ?, ?, ?, ?)`,
    ).bind(
      orderId,
      orderNumber,
      input.shipping.name,
      input.shipping.email,
      input.shipping.phone ?? null,
      input.shipping.line1,
      input.shipping.line2 ?? null,
      input.shipping.city,
      input.shipping.postalCode,
      input.shipping.country.toUpperCase(),
      currency,
      subtotalMinor,
      shippingMinor,
      discountMinor,
      totalMinor,
      input.paymentProvider,
      input.customerNote ?? null,
      reservedUntil,
      appliedCoupon?.id ?? null,
      appliedCoupon?.code ?? null,
    ),
    ...itemInserts.map((item) =>
      c.env.DB.prepare(
        `INSERT INTO order_items (id, order_id, product_id, product_name, product_sku, product_image, unit_price_minor, quantity, line_total_minor)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(item.id, orderId, item.productId, item.name, item.sku, item.image, item.unitPriceMinor, item.quantity, item.lineTotalMinor),
    ),
    // Reserve stock immediately (decrement now, refund on cancel/expiry)
    // rather than only checking-without-reserving -- this is what
    // actually prevents two concurrent checkouts from both succeeding
    // against the last unit. D1 batch() runs these as one transaction.
    ...[...quantitiesByProduct.entries()].map(([productId, quantity]) =>
      c.env.DB.prepare('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?').bind(quantity, productId, quantity),
    ),
    c.env.DB.prepare(
      `INSERT INTO order_status_history (id, order_id, status, note) VALUES (?, ?, 'pending_payment', 'Order created, awaiting payment')`,
    ).bind(`oshist_${crypto.randomUUID()}`, orderId),
    // Same atomic-guard pattern as the stock decrement above: increment
    // used_count only if it's still under the limit (or unlimited),
    // inside the same batch/transaction as the order insert, so two
    // concurrent checkouts racing on the last remaining use can't both
    // succeed. The coupon was already validated against used_count a few
    // lines up, but that read and this write aren't otherwise atomic with
    // each other -- this WHERE clause is what actually closes that gap.
    ...(appliedCoupon
      ? [
          c.env.DB.prepare(
            'UPDATE coupons SET used_count = used_count + 1 WHERE id = ? AND (usage_limit IS NULL OR used_count < usage_limit)',
          ).bind(appliedCoupon.id),
        ]
      : []),
  ];

  await c.env.DB.batch(statements);

  // Create the payment provider's intent/order object now that our order
  // exists and stock is reserved. See lib/payments.ts.
  let paymentPayload: Record<string, unknown>;
  try {
    paymentPayload = await createPaymentIntent(c.env, {
      provider: input.paymentProvider,
      orderId,
      orderNumber,
      amountMinor: totalMinor,
      currency,
      customerEmail: input.shipping.email,
      customerName: input.shipping.name,
    });
  } catch (err) {
    // Payment provider failed to initialize -- release the reservation
    // immediately rather than leaving stock locked for the full
    // reservation window over an order that can never be paid for.
    console.error('Payment intent creation failed:', err);
    await logPaymentError(c.env.DB, err instanceof Error ? err.message : 'Payment intent creation failed', {
      orderId,
      orderNumber,
      provider: input.paymentProvider,
    });
    await c.env.DB.batch([
      ...itemInserts.map((item) =>
        c.env.DB.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').bind(item.quantity, item.productId),
      ),
      c.env.DB.prepare(`UPDATE orders SET status = 'payment_failed', updated_at = datetime('now') WHERE id = ?`).bind(orderId),
    ]);
    return c.json({ error: 'Unable to start payment right now. Please try again in a moment.' }, 502);
  }

  await c.env.DB.prepare('UPDATE orders SET payment_intent_id = ? WHERE id = ?')
    .bind((paymentPayload.paymentIntentId as string) ?? (paymentPayload.orderId as string) ?? null, orderId)
    .run();

  return c.json(
    {
      orderId,
      orderNumber,
      total: toDecimal(totalMinor),
      currency,
      payment: paymentPayload,
    },
    201,
  );
});

// ---------------------------------------------------------------------------
// Public: order status lookup (order number + email, no auth -- this is a
// guest-checkout store so there's no account to authenticate against; the
// email match is the access control)
// ---------------------------------------------------------------------------
orders.get('/lookup', async (c) => {
  const orderNumber = c.req.query('orderNumber')?.trim();
  const email = c.req.query('email')?.trim().toLowerCase();
  if (!orderNumber || !email) {
    return c.json({ error: 'Order number and email are required' }, 400);
  }

  const row = await c.env.DB.prepare('SELECT * FROM orders WHERE order_number = ? AND lower(customer_email) = ?')
    .bind(orderNumber, email)
    .first<OrderRow>();

  if (!row) return c.json({ error: 'No order found matching that order number and email.' }, 404);

  const items = await fetchOrderItems(c.env.DB, row.id);
  return c.json(serializeOrderPublic(row, items));
});

// ---------------------------------------------------------------------------
// Admin: order management
// ---------------------------------------------------------------------------
export const adminOrders = new Hono<{ Bindings: Env; Variables: AuthedVariables }>();
adminOrders.use('*', requireAuth);

adminOrders.get('/', async (c) => {
  const status = c.req.query('status');
  const search = c.req.query('search')?.trim();

  let query = 'SELECT * FROM orders';
  const conditions: string[] = [];
  const params: string[] = [];

  if (status && status !== 'all') {
    conditions.push('status = ?');
    params.push(status);
  }
  if (search) {
    conditions.push('(order_number LIKE ? OR customer_email LIKE ? OR customer_name LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (conditions.length) query += ` WHERE ${conditions.join(' AND ')}`;
  query += ' ORDER BY created_at DESC LIMIT 200';

  const { results } = await c.env.DB.prepare(query).bind(...params).all<OrderRow>();
  const itemsByOrder = new Map<string, OrderItemRow[]>();
  for (const row of results) {
    itemsByOrder.set(row.id, await fetchOrderItems(c.env.DB, row.id));
  }

  return c.json(results.map((row) => serializeOrderAdmin(row, itemsByOrder.get(row.id) ?? [])));
});

adminOrders.get('/:id', async (c) => {
  const id = c.req.param('id');
  const row = await c.env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first<OrderRow>();
  if (!row) return c.json({ error: 'Order not found' }, 404);
  const items = await fetchOrderItems(c.env.DB, id);
  const { results: history } = await c.env.DB.prepare(
    'SELECT * FROM order_status_history WHERE order_id = ? ORDER BY created_at ASC',
  ).bind(id).all();
  return c.json({ ...serializeOrderAdmin(row, items), history });
});

adminOrders.patch('/:id/status', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => null);
  const parsed = orderStatusUpdateSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid status update' }, 400);
  const input = parsed.data;

  const existing = await c.env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first<OrderRow>();
  if (!existing) return c.json({ error: 'Order not found' }, 404);

  const fieldMap: Record<string, unknown> = { status: input.status };
  if (input.status === 'shipped' && !existing.shipped_at) fieldMap.shipped_at = new Date().toISOString();
  if (input.status === 'delivered' && !existing.delivered_at) fieldMap.delivered_at = new Date().toISOString();
  if (input.trackingNumber !== undefined) fieldMap.tracking_number = input.trackingNumber;
  if (input.trackingCarrier !== undefined) fieldMap.tracking_carrier = input.trackingCarrier;

  // Cancelling or refunding a previously-stock-decremented order restores
  // stock. Orders past 'pending_payment' already had stock decremented
  // (reservation -> actual, on payment confirmation, see webhooks.ts), so
  // this is the only other place stock needs to move back.
  const restoresStock =
    (input.status === 'cancelled' || input.status === 'refunded') &&
    !['cancelled', 'refunded', 'pending_payment'].includes(existing.status);

  const setClauses = Object.keys(fieldMap).map((k) => `${k} = ?`).join(', ');
  const statements = [
    c.env.DB.prepare(`UPDATE orders SET ${setClauses}, updated_at = datetime('now') WHERE id = ?`).bind(
      ...Object.values(fieldMap),
      id,
    ),
    c.env.DB.prepare('INSERT INTO order_status_history (id, order_id, status, note, changed_by) VALUES (?, ?, ?, ?, ?)').bind(
      `oshist_${crypto.randomUUID()}`,
      id,
      input.status,
      input.note ?? null,
      c.get('userId'),
    ),
  ];

  if (restoresStock) {
    const items = await fetchOrderItems(c.env.DB, id);
    for (const item of items) {
      if (item.product_id) {
        statements.push(c.env.DB.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').bind(item.quantity, item.product_id));
      }
    }
  }

  await c.env.DB.batch(statements);

  await logAuditEvent(c.env.DB, {
    userId: c.get('userId'),
    action: 'order_status_updated',
    ip: getClientIp(c.req.raw.headers),
    userAgent: c.req.header('User-Agent') ?? null,
    metadata: { orderId: id, newStatus: input.status },
  });

  const updated = await c.env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first<OrderRow>();
  const items = await fetchOrderItems(c.env.DB, id);
  return c.json(serializeOrderAdmin(updated!, items));
});

adminOrders.patch('/:id/note', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => null);
  const note = typeof body?.adminNote === 'string' ? body.adminNote.slice(0, 2000) : null;

  const existing = await c.env.DB.prepare('SELECT id FROM orders WHERE id = ?').bind(id).first();
  if (!existing) return c.json({ error: 'Order not found' }, 404);

  await c.env.DB.prepare(`UPDATE orders SET admin_note = ?, updated_at = datetime('now') WHERE id = ?`).bind(note, id).run();

  const updated = await c.env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first<OrderRow>();
  const items = await fetchOrderItems(c.env.DB, id);
  return c.json(serializeOrderAdmin(updated!, items));
});

export default orders;

/**
 * Called from routes/webhooks.ts once a payment provider confirms payment.
 * Marks the order paid, records the payment reference, sends the
 * confirmation email, and logs the status transition. Idempotent: if the
 * order is already past 'pending_payment' (e.g. a webhook retried
 * delivery), this is a no-op rather than double-sending the confirmation
 * email or re-recording history -- payment webhooks are explicitly
 * allowed to be delivered more than once by both Stripe and Razorpay, so
 * handlers MUST tolerate that.
 */
export async function markOrderPaid(env: Env, params: { orderId: string; paymentReference: string }): Promise<void> {
  const existing = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(params.orderId).first<OrderRow>();
  if (!existing) {
    console.error(`markOrderPaid: order ${params.orderId} not found`);
    return;
  }
  if (existing.status !== 'pending_payment') {
    // Already paid (webhook redelivery) or in some other terminal state --
    // do nothing further.
    return;
  }

  await env.DB.batch([
    env.DB.prepare(
      `UPDATE orders SET status = 'paid', payment_reference = ?, paid_at = datetime('now'), stock_reserved_until = NULL, updated_at = datetime('now') WHERE id = ?`,
    ).bind(params.paymentReference, params.orderId),
    env.DB.prepare(
      `INSERT INTO order_status_history (id, order_id, status, note) VALUES (?, ?, 'paid', 'Payment confirmed by provider webhook')`,
    ).bind(`oshist_${crypto.randomUUID()}`, params.orderId),
  ]);

  const items = await fetchOrderItems(env.DB, params.orderId);
  await sendOrderConfirmationEmail(env, {
    to: existing.customer_email,
    customerName: existing.customer_name,
    orderNumber: existing.order_number,
    total: toDecimal(existing.total_minor),
    currency: existing.currency,
    items: items.map((i) => ({ name: i.product_name, quantity: i.quantity, lineTotal: toDecimal(i.line_total_minor) })),
  }).catch((err) => {
    // Email failure must never fail the payment confirmation -- the
    // customer already paid and the order is real regardless of whether
    // the confirmation email sends. Log and move on.
    console.error('Order confirmation email failed:', err);
    void logPaymentError(env.DB, err instanceof Error ? err.message : 'Order confirmation email failed', {
      orderId: params.orderId,
      orderNumber: existing.order_number,
    });
  });
}

/**
 * Called from routes/webhooks.ts if a payment provider reports a failed
 * or cancelled payment. Releases the stock reservation immediately rather
 * than waiting for the reservation-expiry cron.
 */
export async function markOrderPaymentFailed(env: Env, orderId: string): Promise<void> {
  const existing = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first<OrderRow>();
  if (!existing || existing.status !== 'pending_payment') return;

  const items = await fetchOrderItems(env.DB, orderId);
  await env.DB.batch([
    ...items
      .filter((i) => i.product_id)
      .map((i) => env.DB.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').bind(i.quantity, i.product_id)),
    env.DB.prepare(`UPDATE orders SET status = 'payment_failed', updated_at = datetime('now') WHERE id = ?`).bind(orderId),
    env.DB.prepare(
      `INSERT INTO order_status_history (id, order_id, status, note) VALUES (?, ?, 'payment_failed', 'Payment provider reported failure/cancellation')`,
    ).bind(`oshist_${crypto.randomUUID()}`, orderId),
  ]);
}
