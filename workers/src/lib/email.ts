import type { Env } from './env';

/**
 * Transactional email via Resend (https://resend.com).
 * ------------------------------------------------------
 * Resend was chosen over building raw SMTP (Workers can't open raw TCP
 * sockets to port 25/587 the way a traditional Node server could) or
 * Cloudflare Email Workers (routing-focused, not built for templated
 * transactional sends). Resend's API is a single `fetch` POST, no SDK
 * dependency needed -- consistent with how Stripe/Razorpay are integrated
 * in lib/payments.ts.
 *
 * REQUIRES a real RESEND_API_KEY and a verified sending domain to actually
 * deliver -- see DEPLOYMENT.md §3. Without it configured, this throws,
 * which the caller (markOrderPaid in routes/orders.ts) explicitly catches
 * and logs rather than letting an email failure block order confirmation
 * -- the customer already paid; a missing receipt email must never be
 * treated as a payment failure.
 */

interface OrderConfirmationParams {
  to: string;
  customerName: string;
  orderNumber: string;
  total: number;
  currency: string;
  items: { name: string; quantity: number; lineTotal: number }[];
}

function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function sendOrderConfirmationEmail(env: Env, params: OrderConfirmationParams): Promise<void> {
  if (!env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not configured. Set it with `wrangler secret put RESEND_API_KEY`.');
  }

  const itemRows = params.items
    .map(
      (item) => `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #eee;">${escapeHtml(item.name)} &times; ${item.quantity}</td>
          <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;">${formatMoney(item.lineTotal, params.currency)}</td>
        </tr>`,
    )
    .join('');

  const html = `
    <div style="font-family:-apple-system,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#241b1a;">
      <h1 style="font-size:20px;">Thanks for your order, ${escapeHtml(params.customerName)}!</h1>
      <p>Your order <strong>${escapeHtml(params.orderNumber)}</strong> is confirmed. We'll email you again once it ships.</p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0;">
        ${itemRows}
        <tr>
          <td style="padding:12px 0 0;font-weight:600;">Total</td>
          <td style="padding:12px 0 0;font-weight:600;text-align:right;">${formatMoney(params.total, params.currency)}</td>
        </tr>
      </table>
      <p style="color:#5c504d;font-size:13px;">
        You can check your order status any time at icebrim.com/order-status using this order
        number and the email address you checked out with.
      </p>
    </div>`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      // Must be a verified sending domain in the Resend dashboard, or
      // Resend will reject the send -- see DEPLOYMENT.md §3.
      from: 'Icebrim <orders@icebrim.com>',
      to: [params.to],
      subject: `Order confirmed -- ${params.orderNumber}`,
      html,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Resend send failed (${response.status}): ${errorBody}`);
  }
}
