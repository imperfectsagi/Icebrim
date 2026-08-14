import type { Env } from './env';

/**
 * Payment provider abstraction.
 * -----------------------------
 * Two providers are supported: Stripe (cards, the default/primary rail)
 * and Razorpay (which, for Indian customers, surfaces UPI as a payment
 * method alongside cards -- UPI itself is not a separate global payment
 * network Anthropic/Cloudflare can integrate directly; it's accessed
 * through a payment aggregator licensed for it, and Razorpay is the most
 * commonly used one for that purpose. This file doesn't hardcode "UPI" as
 * its own code path; it hands off to Razorpay's Orders API and lets
 * Razorpay's own checkout UI present whichever methods are enabled on
 * that Razorpay account (UPI, cards, netbanking, wallets).
 *
 * Neither provider's SDK is used here -- Cloudflare Workers' fetch-based
 * runtime doesn't support Stripe's or Razorpay's official Node SDKs
 * cleanly (they assume Node's http/https modules), so both integrations
 * call the REST APIs directly with `fetch`, which is the officially
 * supported approach for both providers on Workers.
 *
 * REQUIRES real API credentials to actually process a payment -- see
 * DEPLOYMENT.md §3 for how to obtain and set them. Without credentials
 * set, createPaymentIntent throws, which routes/orders.ts already handles
 * by rolling back the stock reservation and returning a clear 502 to the
 * customer instead of silently pretending payment succeeded.
 */

export interface CreatePaymentIntentParams {
  provider: 'stripe' | 'razorpay';
  orderId: string;
  orderNumber: string;
  amountMinor: number; // integer minor units (pence for GBP, paise for INR)
  currency: string; // ISO 4217, e.g. "GBP"
  customerEmail: string;
  customerName: string;
}

/**
 * Creates a provider-side payment object and returns whatever the
 * frontend needs to complete payment: for Stripe, a client_secret to hand
 * to Stripe.js/Elements; for Razorpay, an order id + key id to hand to
 * Razorpay's Checkout.js widget.
 */
export async function createPaymentIntent(env: Env, params: CreatePaymentIntentParams): Promise<Record<string, unknown>> {
  if (params.provider === 'stripe') return createStripePaymentIntent(env, params);
  return createRazorpayOrder(env, params);
}

async function createStripePaymentIntent(env: Env, params: CreatePaymentIntentParams): Promise<Record<string, unknown>> {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured. Set it with `wrangler secret put STRIPE_SECRET_KEY`.');
  }

  const body = new URLSearchParams({
    amount: String(params.amountMinor),
    currency: params.currency.toLowerCase(),
    'automatic_payment_methods[enabled]': 'true',
    'metadata[orderId]': params.orderId,
    'metadata[orderNumber]': params.orderNumber,
    receipt_email: params.customerEmail,
    description: `Icebrim order ${params.orderNumber}`,
  });

  const response = await fetch('https://api.stripe.com/v1/payment_intents', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Stripe PaymentIntent creation failed (${response.status}): ${errorBody}`);
  }

  const data = (await response.json()) as { id: string; client_secret: string };
  return {
    provider: 'stripe' as const,
    paymentIntentId: data.id,
    clientSecret: data.client_secret,
  };
}

async function createRazorpayOrder(env: Env, params: CreatePaymentIntentParams): Promise<Record<string, unknown>> {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw new Error(
      'RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not configured. Set them with `wrangler secret put`.',
    );
  }

  // Razorpay's Orders API takes amount in the smallest currency unit too
  // (paise for INR), same representation this codebase already uses
  // internally -- no conversion needed here regardless of which currency
  // the store is running in, as long as amountMinor was computed
  // correctly for that currency's minor unit (see lib/money.ts).
  const credentials = btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`);

  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: params.amountMinor,
      currency: params.currency.toUpperCase(),
      receipt: params.orderNumber,
      notes: { orderId: params.orderId, orderNumber: params.orderNumber },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Razorpay order creation failed (${response.status}): ${errorBody}`);
  }

  const data = (await response.json()) as { id: string };
  return {
    provider: 'razorpay' as const,
    orderId: data.id,
    keyId: env.RAZORPAY_KEY_ID,
    amount: params.amountMinor,
    currency: params.currency.toUpperCase(),
  };
}

/**
 * Verifies a Stripe webhook signature using the raw request body (must be
 * the exact bytes Stripe sent -- do NOT re-serialize a parsed JSON object,
 * the signature is over the raw string). Implements Stripe's documented
 * HMAC-SHA256 signature scheme without the Stripe SDK, using Web Crypto
 * (available in the Workers runtime, unlike Node's `crypto` module which
 * Stripe's SDK expects).
 */
export async function verifyStripeSignature(rawBody: string, signatureHeader: string | null, secret: string): Promise<boolean> {
  if (!signatureHeader) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(',').map((pair) => {
      const [key, value] = pair.split('=');
      return [key, value];
    }),
  );
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  const signedPayload = `${timestamp}.${rawBody}`;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload));
  const expectedSignature = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');

  return timingSafeEqual(expectedSignature, signature);
}

/**
 * Verifies a Razorpay webhook signature: HMAC-SHA256 of the raw body using
 * the webhook secret (distinct from the API key secret -- configured
 * separately in the Razorpay dashboard under Webhooks).
 */
export async function verifyRazorpaySignature(rawBody: string, signatureHeader: string | null, secret: string): Promise<boolean> {
  if (!signatureHeader) return false;

  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  const expectedSignature = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');

  return timingSafeEqual(expectedSignature, signatureHeader);
}

/** Constant-time string comparison -- prevents a timing side-channel from leaking the correct signature one byte at a time. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
