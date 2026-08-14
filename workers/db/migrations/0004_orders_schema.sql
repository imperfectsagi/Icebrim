-- ---------------------------------------------------------------------------
-- E-commerce: orders and order line items.
--
-- This is a guest-checkout store (there's no customer account/login system --
-- only the separate admin `users` table for the CMS/admin panel). An order
-- is identified by its own id plus the customer's email/shipping address
-- captured at checkout time, not a foreign key to a user account.
--
-- Money is stored in the smallest currency unit (pence, for GBP) as an
-- INTEGER, never as a float -- floating point arithmetic on prices is a
-- classic source of off-by-a-penny bugs and reconciliation headaches.
-- Everywhere else in this codebase (`products.price`) stores decimal GBP
-- as REAL; that's fine for admin-entered catalog prices but NOT fine for
-- computed order totals that must reconcile exactly against what a payment
-- processor actually charged, so orders intentionally uses a different
-- representation. serializeOrder() in routes/orders.ts converts pence back
-- to decimal pounds for the API response.
-- ---------------------------------------------------------------------------

CREATE TABLE orders (
  id TEXT PRIMARY KEY,                 -- e.g. "ord_<uuid>"
  order_number TEXT NOT NULL UNIQUE,   -- short human-facing reference, e.g. "IB-100042"

  -- Snapshot of customer/shipping info at time of order. Deliberately NOT
  -- normalized into a separate customers/addresses table: this is a
  -- guest-checkout store, and an order is a point-in-time record of what
  -- was agreed, so it must NOT change if the customer later "updates their
  -- address" somewhere else that doesn't exist in this system.
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  shipping_line1 TEXT NOT NULL,
  shipping_line2 TEXT,
  shipping_city TEXT NOT NULL,
  shipping_postal_code TEXT NOT NULL,
  shipping_country TEXT NOT NULL,      -- ISO 3166-1 alpha-2, e.g. "GB"

  currency TEXT NOT NULL DEFAULT 'GBP',
  subtotal_minor INTEGER NOT NULL,     -- sum of line items, in pence
  shipping_minor INTEGER NOT NULL DEFAULT 0,
  discount_minor INTEGER NOT NULL DEFAULT 0,
  total_minor INTEGER NOT NULL,        -- subtotal + shipping - discount, in pence

  -- Order lifecycle. 'pending_payment' is created before the customer pays
  -- (stock is reserved, not yet decremented -- see stock_reserved_until);
  -- a webhook (see routes/webhooks.ts) moves it to 'paid' once the payment
  -- provider confirms, at which point stock is actually decremented.
  status TEXT NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN ('pending_payment', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded', 'payment_failed')),

  payment_provider TEXT CHECK (payment_provider IN ('stripe', 'razorpay') OR payment_provider IS NULL),
  payment_intent_id TEXT,              -- Stripe PaymentIntent id, or Razorpay order id
  payment_reference TEXT,              -- provider's charge/payment id once captured, for support lookups
  paid_at TEXT,

  tracking_number TEXT,
  tracking_carrier TEXT,
  shipped_at TEXT,
  delivered_at TEXT,

  -- Stock is reserved (not decremented) when a pending order is created, so
  -- two customers can't both "successfully" order the last unit while one
  -- of them is still on the payment page. If payment isn't confirmed
  -- before this timestamp, the reservation is released back to available
  -- stock (see releaseExpiredReservations in routes/orders.ts, invoked via
  -- Worker cron -- see wrangler.toml [triggers]).
  stock_reserved_until TEXT,

  customer_note TEXT,
  admin_note TEXT,                     -- internal-only, never exposed to the public order-status endpoint

  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_email ON orders(customer_email);
CREATE INDEX idx_orders_payment_intent ON orders(payment_intent_id);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_reserved_until ON orders(stock_reserved_until) WHERE status = 'pending_payment';

-- ---------------------------------------------------------------------------
-- Order line items -- one row per product per order.
--
-- Product name/price/image are SNAPSHOTTED at order time (copied, not
-- referenced live) so that an order's paperwork/invoice/history stays
-- accurate forever even if the admin later renames, re-prices, or deletes
-- that product. product_id is kept (nullable, ON DELETE SET NULL) purely
-- as a convenience link back to the current catalog entry, never as the
-- source of truth for what the customer actually bought or paid.
-- ---------------------------------------------------------------------------
CREATE TABLE order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL,

  product_name TEXT NOT NULL,
  product_sku TEXT NOT NULL,
  product_image TEXT,

  unit_price_minor INTEGER NOT NULL,   -- price at time of order, in pence
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  line_total_minor INTEGER NOT NULL,   -- unit_price_minor * quantity

  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);

-- ---------------------------------------------------------------------------
-- Order status history -- an audit trail distinct from the general
-- audit_log table (which is keyed to an admin user action); this tracks
-- the order's own lifecycle regardless of whether a human or a webhook
-- caused the transition, which is what the admin order-detail timeline
-- and customer-facing order-status page both need to render.
-- ---------------------------------------------------------------------------
CREATE TABLE order_status_history (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  note TEXT,
  changed_by TEXT REFERENCES users(id) ON DELETE SET NULL,  -- NULL if system/webhook-triggered
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_order_status_history_order_id ON order_status_history(order_id);
