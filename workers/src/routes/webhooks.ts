import { Hono } from 'hono';
import type { Env } from '../lib/env';
import { verifyStripeSignature, verifyRazorpaySignature } from '../lib/payments';
import { logError } from '../lib/error-log';
import { markOrderPaid, markOrderPaymentFailed } from './orders';

/**
 * Payment provider webhooks.
 * --------------------------
 * These are the ONLY place an order actually gets marked 'paid' -- never
 * on the frontend's "payment succeeded" redirect, which a user could reach
 * by editing the URL without ever actually paying. The frontend redirect
 * after checkout only shows an optimistic "processing your order" state;
 * this webhook is the source of truth.
 *
 * Every request is signature-verified against the raw request body BEFORE
 * any of its contents are trusted, using each provider's documented HMAC
 * scheme (see lib/payments.ts). An unsigned or wrongly-signed request is
 * rejected with 400 regardless of what it claims -- otherwise anyone who
 * discovers this URL could POST a fake "payment succeeded" event for any
 * order and get free product.
 */
const webhooks = new Hono<{ Bindings: Env }>();

webhooks.post('/stripe', async (c) => {
  if (!c.env.STRIPE_WEBHOOK_SECRET) {
    console.error('Stripe webhook received but STRIPE_WEBHOOK_SECRET is not configured');
    return c.json({ error: 'Webhook not configured' }, 500);
  }

  const rawBody = await c.req.text();
  const signature = c.req.header('Stripe-Signature');
  const valid = await verifyStripeSignature(rawBody, signature ?? null, c.env.STRIPE_WEBHOOK_SECRET);
  if (!valid) {
    console.error('Stripe webhook signature verification failed');
    await logError(c.env.DB, {
      category: 'webhook',
      message: 'Stripe webhook signature verification failed',
      path: '/api/webhooks/stripe',
    });
    return c.json({ error: 'Invalid signature' }, 400);
  }

  const event = JSON.parse(rawBody) as {
    type: string;
    data: { object: { id: string; metadata?: { orderId?: string } } };
  };

  const orderId = event.data.object.metadata?.orderId;

  switch (event.type) {
    case 'payment_intent.succeeded':
      if (orderId) await markOrderPaid(c.env, { orderId, paymentReference: event.data.object.id });
      break;
    case 'payment_intent.payment_failed':
    case 'payment_intent.canceled':
      if (orderId) await markOrderPaymentFailed(c.env, orderId);
      break;
    default:
      // Ignore event types we don't act on (Stripe sends many). Returning
      // 200 for unhandled types is correct/expected per Stripe's docs --
      // it tells Stripe delivery succeeded so it stops retrying, even
      // though we didn't do anything with this particular event type.
      break;
  }

  return c.json({ received: true });
});

webhooks.post('/razorpay', async (c) => {
  if (!c.env.RAZORPAY_WEBHOOK_SECRET) {
    console.error('Razorpay webhook received but RAZORPAY_WEBHOOK_SECRET is not configured');
    return c.json({ error: 'Webhook not configured' }, 500);
  }

  const rawBody = await c.req.text();
  const signature = c.req.header('X-Razorpay-Signature');
  const valid = await verifyRazorpaySignature(rawBody, signature ?? null, c.env.RAZORPAY_WEBHOOK_SECRET);
  if (!valid) {
    console.error('Razorpay webhook signature verification failed');
    await logError(c.env.DB, {
      category: 'webhook',
      message: 'Razorpay webhook signature verification failed',
      path: '/api/webhooks/razorpay',
    });
    return c.json({ error: 'Invalid signature' }, 400);
  }

  const event = JSON.parse(rawBody) as {
    event: string;
    payload: { payment?: { entity: { id: string; order_id: string; notes?: { orderId?: string } } } };
  };

  const orderId = event.payload.payment?.entity.notes?.orderId;

  switch (event.event) {
    case 'payment.captured':
      if (orderId && event.payload.payment) {
        await markOrderPaid(c.env, { orderId, paymentReference: event.payload.payment.entity.id });
      }
      break;
    case 'payment.failed':
      if (orderId) await markOrderPaymentFailed(c.env, orderId);
      break;
    default:
      break;
  }

  return c.json({ received: true });
});

export default webhooks;
