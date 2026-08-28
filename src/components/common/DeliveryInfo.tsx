import { Truck } from 'lucide-react';
import { useDeliveryInfo } from '@/hooks/useContent';
import { cn } from '@/lib/utils';

/**
 * The one place the saved delivery estimate (Admin -> Delivery Info) is
 * read and rendered. Every public location that shows delivery time --
 * product page, checkout, order confirmation, order status -- renders
 * this component rather than each hardcoding its own copy, so there is
 * exactly one source of truth and one place to update if the display
 * needs to change later.
 *
 * Renders nothing if delivery info is disabled or has no text saved, so
 * call sites don't need their own enabled-check before using it.
 */
export function DeliveryInfo({ className }: { className?: string }) {
  const { data } = useDeliveryInfo();

  if (!data?.enabled || !data.text) return null;

  return (
    <p className={cn('flex items-center gap-2 text-sm text-[var(--color-ink-soft)]', className)}>
      <Truck size={16} className="shrink-0 text-[var(--color-coral-deep)]" aria-hidden="true" />
      <span>Estimated delivery: {data.text}</span>
    </p>
  );
}
