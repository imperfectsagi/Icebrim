/**
 * Money is stored as integer minor units (pence, for GBP) throughout the
 * order/checkout/payment pipeline -- see migration 0004_orders_schema.sql
 * for why. The product catalog itself still stores decimal pounds (REAL)
 * since that's an existing, unrelated part of the schema this repair plan
 * didn't ask to change; these helpers are the single place that conversion
 * happens; nothing else should do `price * 100` inline.
 */

/** Converts a decimal amount (e.g. product.price = 34.99) to integer minor units (3499). */
export function toMinorUnits(decimal: number): number {
  // Round rather than truncate: floating point means 34.99 * 100 can come
  // out as 3498.999999999999, and Math.trunc would silently undercharge.
  return Math.round(decimal * 100);
}

/** Converts integer minor units (3499) back to a decimal amount (34.99) for API responses. */
export function toDecimal(minor: number): number {
  return Math.round(minor) / 100;
}

/** Generates a short, human-facing order reference like "IB-482913". Not a security token -- just a support/lookup-friendly label; the real identifier is the order's UUID-based id. */
export function generateOrderNumber(): string {
  const random = Math.floor(100000 + Math.random() * 900000); // 6 digits
  return `IB-${random}`;
}
