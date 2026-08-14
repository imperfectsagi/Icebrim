/**
 * Shared coupon logic used by both routes/admin-coupons.ts (CRUD) and
 * routes/orders.ts (checkout validation + discount calculation).
 * Centralizing this here means checkout and the admin "preview" can never
 * disagree about what a coupon is worth -- there is exactly one place
 * that computes a discount from a coupon row.
 */

export type CouponRow = {
  id: string;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  active: number; // SQLite boolean: 0 | 1
  expires_at: string | null;
  usage_limit: number | null;
  used_count: number;
  min_order_subtotal_minor: number | null;
};

/** Coupon codes are matched case-insensitively; this is the single place that defines the canonical stored/compared form. */
export function normalizeCouponCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export type CouponValidationResult =
  | { valid: true; discountMinor: number }
  | { valid: false; reason: 'not_found' | 'inactive' | 'expired' | 'usage_limit_reached' | 'below_minimum_order' };

/**
 * Computes the discount (in pence) a coupon would apply to a given
 * subtotal, and validates every condition that could make a coupon
 * unusable right now. This is deliberately the ONLY function that decides
 * whether a coupon is currently valid -- both the checkout endpoint and
 * any future "check this code" endpoint should call this rather than
 * re-implementing the checks, so the two can't drift apart.
 *
 * `subtotalMinor` must already be the server-recomputed subtotal (from
 * current product prices), not anything the client sent -- see the
 * checkout handler in routes/orders.ts, which follows the same
 * never-trust-the-client rule for prices that this function extends to
 * discounts.
 */
export function validateCoupon(coupon: CouponRow | null, subtotalMinor: number, now: Date = new Date()): CouponValidationResult {
  if (!coupon) return { valid: false, reason: 'not_found' };
  if (!coupon.active) return { valid: false, reason: 'inactive' };
  if (coupon.expires_at && new Date(coupon.expires_at).getTime() < now.getTime()) {
    return { valid: false, reason: 'expired' };
  }
  if (coupon.usage_limit !== null && coupon.used_count >= coupon.usage_limit) {
    return { valid: false, reason: 'usage_limit_reached' };
  }
  if (coupon.min_order_subtotal_minor !== null && subtotalMinor < coupon.min_order_subtotal_minor) {
    return { valid: false, reason: 'below_minimum_order' };
  }

  const rawDiscount =
    coupon.discount_type === 'percentage'
      ? Math.round((subtotalMinor * coupon.discount_value) / 100)
      : coupon.discount_value;

  // Never let a discount exceed the subtotal -- a fixed-amount coupon
  // applied to a cart smaller than its face value should discount to
  // zero, not produce a negative total.
  const discountMinor = Math.max(0, Math.min(rawDiscount, subtotalMinor));

  return { valid: true, discountMinor };
}

/** User-facing messages for each invalid reason -- kept alongside the validation logic so wording stays consistent everywhere a coupon can be rejected. */
export function couponErrorMessage(reason: Exclude<CouponValidationResult, { valid: true }>['reason']): string {
  switch (reason) {
    case 'not_found':
      return 'This coupon code is not valid.';
    case 'inactive':
      return 'This coupon is no longer active.';
    case 'expired':
      return 'This coupon has expired.';
    case 'usage_limit_reached':
      return 'This coupon has reached its usage limit.';
    case 'below_minimum_order':
      return 'Your order does not meet the minimum amount required for this coupon.';
  }
}
