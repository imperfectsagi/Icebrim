-- ---------------------------------------------------------------------------
-- Coupon codes.
--
-- Discounts are always calculated server-side at checkout time (see
-- routes/orders.ts `checkout` handler) from this table -- the client never
-- sends a discount amount, only a coupon *code* string, exactly the same
-- trust boundary this codebase already applies to product prices (see the
-- comment above the checkout handler: "a tampered client sending a fake
-- discounted price" is the thing being defended against; coupons are the
-- same category of risk and get the same treatment).
--
-- discount_value follows the same money convention as orders.*_minor
-- (pence, INTEGER) when discount_type = 'fixed'. When discount_type =
-- 'percentage', discount_value is a whole-number percentage (1-100), NOT
-- pence -- see the CHECK constraint below, which enforces sane bounds for
-- each type so a malformed row can't silently produce a nonsensical or
-- negative total downstream.
-- ---------------------------------------------------------------------------

CREATE TABLE coupons (
  id TEXT PRIMARY KEY,                 -- e.g. "cpn_<uuid>"
  code TEXT NOT NULL UNIQUE,           -- normalized uppercase, e.g. "WELCOME10" -- see lib/coupons.ts normalizeCouponCode()

  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value INTEGER NOT NULL,     -- percentage: 1-100. fixed: pence, > 0. Enforced below.

  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  expires_at TEXT,                     -- ISO datetime, NULL = never expires
  usage_limit INTEGER,                 -- NULL = unlimited uses
  used_count INTEGER NOT NULL DEFAULT 0,

  -- Optional floor so "10% off" can't be combined with a near-zero cart to
  -- produce an absurd effective discount, and so the admin has a lever to
  -- prevent a coupon being used on a single low-value item if that's not
  -- the intent. NULL = no minimum.
  min_order_subtotal_minor INTEGER,

  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  CHECK (
    (discount_type = 'percentage' AND discount_value BETWEEN 1 AND 100)
    OR (discount_type = 'fixed' AND discount_value > 0)
  ),
  CHECK (usage_limit IS NULL OR usage_limit > 0),
  CHECK (used_count >= 0),
  CHECK (min_order_subtotal_minor IS NULL OR min_order_subtotal_minor >= 0)
);

CREATE INDEX idx_coupons_code ON coupons(code);
CREATE INDEX idx_coupons_active ON coupons(active);

-- Records which coupon (if any) an order used, for reporting and so
-- used_count can be incremented exactly once per successful checkout (not
-- once per validation call -- a customer might check a code's validity,
-- referenced by the storefront while they're still filling out the form,
-- several times before actually placing the order). NULL = no coupon
-- used. ON DELETE SET NULL rather than blocking coupon deletion: past
-- orders are a historical record and must remain readable even after the
-- admin deletes/deactivates the coupon that was used on them (the actual
-- discount already applied is preserved separately in
-- orders.discount_minor regardless of what happens to this reference).
ALTER TABLE orders ADD COLUMN coupon_id TEXT REFERENCES coupons(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN coupon_code TEXT; -- snapshot of the code text at order time, so it still displays even after coupon_id is nulled out
