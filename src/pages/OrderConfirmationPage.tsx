import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import { Container } from '@/components/ui/primitives';
import { Button } from '@/components/ui/Button';
import { SeoHead } from '@/components/common/SeoHead';
import { api, ApiError } from '@/lib/api-client';
import { formatPrice } from '@/lib/utils';
import type { Order } from '@/types/cms';

/**
 * Shown right after the customer returns from Stripe/Razorpay. The
 * payment webhook (see workers/src/routes/webhooks.ts) is what actually
 * marks the order paid, and it can arrive a few seconds after the
 * customer is redirected back here -- so this page polls order status for
 * a short window rather than assuming "I got redirected here" means
 * "payment succeeded".
 */
export default function OrderConfirmationPage() {
  const [searchParams] = useSearchParams();
  const orderNumber = searchParams.get('orderNumber');
  const email = searchParams.get('email');
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (!orderNumber || !email) {
      setError('Missing order details.');
      return;
    }

    let cancelled = false;
    const MAX_ATTEMPTS = 8; // ~24 seconds of polling at 3s intervals

    const poll = async () => {
      try {
        const result = await api.get<Order>(
          `/api/orders/lookup?orderNumber=${encodeURIComponent(orderNumber)}&email=${encodeURIComponent(email)}`,
        );
        if (cancelled) return;
        setOrder(result);
        // Keep polling a little longer if still pending -- the webhook
        // may not have landed yet -- but stop once it resolves either way.
        if (result.status === 'pending_payment' && attempts < MAX_ATTEMPTS) {
          setTimeout(() => setAttempts((a) => a + 1), 3000);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : 'Unable to load your order right now.');
      }
    };

    poll();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `attempts` intentionally re-triggers the poll; orderNumber/email are stable from the URL
  }, [orderNumber, email, attempts]);

  return (
    <>
      <SeoHead seo={{ title: 'Order confirmation — Icebrim', description: 'Your order confirmation.', canonicalPath: '/order-confirmation' }} />
      <section className="py-16 md:py-24">
        <Container className="max-w-xl text-center">
          {error && !order && (
            <>
              <XCircle size={40} className="mx-auto text-[var(--color-coral-deep)] mb-4" aria-hidden="true" />
              <h1 className="font-display text-2xl font-medium mb-2">We couldn't find that order</h1>
              <p className="text-[var(--color-ink-soft)] mb-6">{error}</p>
              <Button href="/order-status">Look up your order</Button>
            </>
          )}

          {!error && !order && (
            <>
              <div className="mx-auto mb-4 h-8 w-8 border-2 border-[var(--color-coral)] border-t-transparent rounded-full animate-spin" />
              <p className="text-[var(--color-ink-soft)]">Confirming your order…</p>
            </>
          )}

          {order && order.status === 'pending_payment' && (
            <>
              <Clock size={40} className="mx-auto text-[var(--color-ink-soft)] mb-4" aria-hidden="true" />
              <h1 className="font-display text-2xl font-medium mb-2">Confirming payment…</h1>
              <p className="text-[var(--color-ink-soft)] mb-6">
                Order <strong>{order.orderNumber}</strong> is being confirmed. This page will update automatically
                -- you can also safely close it, we'll email you once it's confirmed.
              </p>
            </>
          )}

          {order && order.status === 'payment_failed' && (
            <>
              <XCircle size={40} className="mx-auto text-[var(--color-coral-deep)] mb-4" aria-hidden="true" />
              <h1 className="font-display text-2xl font-medium mb-2">Payment didn't go through</h1>
              <p className="text-[var(--color-ink-soft)] mb-6">
                Order <strong>{order.orderNumber}</strong> wasn't charged. Please try again, or contact us if
                you're not sure what happened.
              </p>
              <Button href="/contact">Contact us</Button>
            </>
          )}

          {order && !['pending_payment', 'payment_failed'].includes(order.status) && (
            <>
              <CheckCircle2 size={40} className="mx-auto text-[var(--color-coral)] mb-4" aria-hidden="true" />
              <h1 className="font-display text-2xl font-medium mb-2">Thank you, {order.customer.name.split(' ')[0]}!</h1>
              <p className="text-[var(--color-ink-soft)] mb-8">
                Your order <strong>{order.orderNumber}</strong> is confirmed. We've sent a confirmation to{' '}
                {order.customer.email}.
              </p>

              <div className="text-left rounded-[var(--radius-card)] border border-[var(--color-line)] p-5 mb-8 space-y-3">
                {order.items.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-[var(--color-ink-soft)]">
                      {item.name} × {item.quantity}
                    </span>
                    <span className="font-medium">{formatPrice(item.lineTotal, order.currency)}</span>
                  </div>
                ))}
                <div className="pt-3 border-t border-[var(--color-line)] flex justify-between text-sm font-semibold">
                  <span>Total</span>
                  <span>{formatPrice(order.total, order.currency)}</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button href="/products" variant="secondary">
                  Continue shopping
                </Button>
                <Button href={`/order-status?orderNumber=${order.orderNumber}&email=${order.customer.email}`}>
                  Track this order
                </Button>
              </div>
            </>
          )}

          <p className="text-xs text-[var(--color-ink-soft)] mt-10">
            <Link to="/order-status" className="underline hover:text-[var(--color-coral-deep)]">
              Look up an order
            </Link>{' '}
            any time with your order number and email.
          </p>
        </Container>
      </section>
    </>
  );
}
