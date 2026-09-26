import { Hono } from 'hono';
import type { Env } from '../lib/env';
import { popupEmailSubmitSchema } from '../lib/schemas';
import { getClientIp } from '../lib/login-security';
import { getSiteContentRaw } from '../lib/site-content';
import type { CouponRow } from '../lib/coupons';

/**
 * Public submit endpoint for the customer offer popup (see
 * src/components/common/OfferPopup.tsx). Same rate-limit/schema/shape as
 * the existing newsletter signup endpoint (routes/contact.ts's
 * `newsletter` export) -- this is deliberately a separate, smaller table
 * rather than reusing newsletter_subscribers, because the two capture
 * different things: newsletter_subscribers is a single
 * subscribed/unsubscribed record per address, while this is a log of
 * popup submissions (the same visitor may submit again for a later
 * offer) that also needs to remember which coupon was shown at the time
 * -- see migration 0013_popup_offer_emails.sql.
 */
const popupEmails = new Hono<{ Bindings: Env }>();

popupEmails.post('/', async (c) => {
  const ip = getClientIp(c.req.raw.headers);
  const rateLimitResult = await c.env.FORM_RATE_LIMITER.limit({ key: `popup-offer:${ip}` });
  if (!rateLimitResult.success) {
    return c.json({ error: 'Too many attempts. Please try again later.' }, 429);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = popupEmailSubmitSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Enter a valid email address' }, 400);

  // Re-resolve the currently configured popup coupon server-side rather
  // than trusting a coupon code the client might send -- same
  // never-trust-the-client boundary as checkout/orders.ts. If the popup
  // has since been disabled, or its linked coupon deleted/deactivated/
  // expired between the visitor loading the page and submitting the
  // form, this snapshots null rather than a code that no longer applies.
  const settings = (await getSiteContentRaw(c.env.DB, 'popup_offer')) as
    | { enabled?: boolean; couponId?: string | null }
    | null;

  let couponCode: string | null = null;
  if (settings?.enabled && settings.couponId) {
    const coupon = await c.env.DB.prepare('SELECT * FROM coupons WHERE id = ?').bind(settings.couponId).first<CouponRow>();
    const isCurrentlyValid =
      !!coupon &&
      !!coupon.active &&
      (!coupon.expires_at || new Date(coupon.expires_at).getTime() >= Date.now()) &&
      (coupon.usage_limit === null || coupon.used_count < coupon.usage_limit);
    if (isCurrentlyValid) couponCode = coupon!.code;
  }

  const id = `pop_${crypto.randomUUID()}`;
  await c.env.DB.prepare('INSERT INTO popup_offer_emails (id, email, coupon_code) VALUES (?, ?, ?)')
    .bind(id, parsed.data.email, couponCode)
    .run();

  return c.json({ success: true, couponCode }, 201);
});

export default popupEmails;
