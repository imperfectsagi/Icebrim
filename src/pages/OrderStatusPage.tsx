import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Package, Truck, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { Container } from '@/components/ui/primitives';
import { Button } from '@/components/ui/Button';
import { SeoHead } from '@/components/common/SeoHead';
import { api, ApiError } from '@/lib/api-client';
import { formatPrice, formatDate } from '@/lib/utils';
import type { Order, OrderStatus } from '@/types/cms';

const schema = z.object({
  orderNumber: z.string().min(1, 'Enter your order number'),
  email: z.string().min(1, 'Enter your email').email('Enter a valid email address'),
});
type FormValues = z.infer<typeof schema>;

const STATUS_META: Record<OrderStatus, { label: string; icon: typeof Package; tone: string }> = {
  pending_payment: { label: 'Awaiting payment', icon: Clock, tone: 'text-[var(--color-ink-soft)]' },
  paid: { label: 'Payment confirmed', icon: CheckCircle2, tone: 'text-[var(--color-coral-deep)]' },
  processing: { label: 'Preparing your order', icon: Package, tone: 'text-[var(--color-coral-deep)]' },
  shipped: { label: 'Shipped', icon: Truck, tone: 'text-[var(--color-coral-deep)]' },
  delivered: { label: 'Delivered', icon: CheckCircle2, tone: 'text-green-700' },
  cancelled: { label: 'Cancelled', icon: XCircle, tone: 'text-[var(--color-ink-soft)]' },
  refunded: { label: 'Refunded', icon: XCircle, tone: 'text-[var(--color-ink-soft)]' },
  payment_failed: { label: 'Payment failed', icon: XCircle, tone: 'text-[var(--color-coral-deep)]' },
};

export default function OrderStatusPage() {
  const [searchParams] = useSearchParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      orderNumber: searchParams.get('orderNumber') ?? '',
      email: searchParams.get('email') ?? '',
    },
  });

  const onSubmit = async (values: FormValues) => {
    setLookupError(null);
    setOrder(null);
    try {
      const result = await api.get<Order>(
        `/api/orders/lookup?orderNumber=${encodeURIComponent(values.orderNumber.trim())}&email=${encodeURIComponent(values.email.trim())}`,
      );
      setOrder(result);
    } catch (err) {
      setLookupError(err instanceof ApiError ? err.message : 'Unable to look up your order right now.');
    }
  };

  // Auto-run the lookup once if both fields arrived via URL (e.g. the
  // "Track this order" link from the confirmation page) -- runs exactly
  // once on mount, not on every render.
  useEffect(() => {
    if (searchParams.get('orderNumber') && searchParams.get('email')) {
      handleSubmit(onSubmit)();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally run-once on mount
  }, []);

  const meta = order ? STATUS_META[order.status] : null;
  const StatusIcon = meta?.icon;

  return (
    <>
      <SeoHead seo={{ title: 'Order status — Icebrim', description: 'Look up your Icebrim order status.', canonicalPath: '/order-status' }} />
      <section className="py-12 md:py-20">
        <Container className="max-w-lg">
          <h1 className="font-display text-3xl font-medium mb-2">Order status</h1>
          <p className="text-[var(--color-ink-soft)] mb-8">
            Enter your order number and the email you used at checkout.
          </p>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4 mb-10">
            <label className="block">
              <span className="block text-sm font-medium mb-1.5">Order number</span>
              <input className="form-input" placeholder="IB-100042" {...register('orderNumber')} />
              {errors.orderNumber && (
                <span className="block text-xs text-[var(--color-coral-deep)] mt-1">{errors.orderNumber.message}</span>
              )}
            </label>
            <label className="block">
              <span className="block text-sm font-medium mb-1.5">Email</span>
              <input type="email" className="form-input" {...register('email')} />
              {errors.email && (
                <span className="block text-xs text-[var(--color-coral-deep)] mt-1">{errors.email.message}</span>
              )}
            </label>
            <Button type="submit" disabled={isSubmitting} className="w-full justify-center">
              {isSubmitting ? 'Looking up…' : 'Find my order'}
            </Button>
          </form>

          {lookupError && (
            <p role="alert" className="text-sm text-[var(--color-coral-deep)] mb-8">
              {lookupError}
            </p>
          )}

          {order && meta && StatusIcon && (
            <div className="rounded-[var(--radius-card)] border border-[var(--color-line)] p-5">
              <div className="flex items-center gap-2 mb-1">
                <StatusIcon size={18} className={meta.tone} aria-hidden="true" />
                <span className={`font-semibold ${meta.tone}`}>{meta.label}</span>
              </div>
              <p className="text-sm text-[var(--color-ink-soft)] mb-4">
                Order {order.orderNumber} · placed {formatDate(order.createdAt)}
              </p>

              {order.tracking && (
                <p className="text-sm mb-4">
                  Tracking: <span className="font-medium">{order.tracking.number}</span>
                  {order.tracking.carrier && ` (${order.tracking.carrier})`}
                </p>
              )}

              <div className="space-y-2 mb-4">
                {order.items.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-[var(--color-ink-soft)]">
                      {item.name} × {item.quantity}
                    </span>
                    <span className="font-medium">{formatPrice(item.lineTotal, order.currency)}</span>
                  </div>
                ))}
              </div>
              <div className="pt-3 border-t border-[var(--color-line)] flex justify-between text-sm font-semibold">
                <span>Total</span>
                <span>{formatPrice(order.total, order.currency)}</span>
              </div>
            </div>
          )}
        </Container>
      </section>
    </>
  );
}
