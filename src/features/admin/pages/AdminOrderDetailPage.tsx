import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { AdminPageHeader, AdminCard, FormRow } from '../components/AdminUi';
import { Button } from '@/components/ui/Button';
import { useAdminOrder, useUpdateOrderStatus, useUpdateOrderNote } from '../hooks/useAdminOrders';
import { formatPrice, formatDate } from '@/lib/utils';
import type { OrderStatus } from '@/types/cms';

const STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: 'pending_payment', label: 'Awaiting payment' },
  { value: 'paid', label: 'Paid' },
  { value: 'processing', label: 'Processing' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'refunded', label: 'Refunded' },
  { value: 'payment_failed', label: 'Payment failed' },
];

export function AdminOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: order, isLoading } = useAdminOrder(id);
  const updateStatus = useUpdateOrderStatus();
  const updateNote = useUpdateOrderNote();

  const [pendingStatus, setPendingStatus] = useState<OrderStatus | ''>('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingCarrier, setTrackingCarrier] = useState('');
  const [adminNote, setAdminNote] = useState('');

  useEffect(() => {
    if (order) setAdminNote(order.adminNote ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-sync when the order id changes, not on every order object reference change (e.g. after our own note save)
  }, [order?.id]);

  if (isLoading) return <p className="text-sm text-[var(--color-ink-soft)]">Loading…</p>;
  if (!order) return <p className="text-sm text-[var(--color-ink-soft)]">Order not found.</p>;

  const handleStatusUpdate = async () => {
    if (!pendingStatus || !id) return;
    await updateStatus.mutateAsync({
      id,
      status: pendingStatus,
      trackingNumber: trackingNumber || undefined,
      trackingCarrier: trackingCarrier || undefined,
    });
    setPendingStatus('');
  };

  return (
    <div>
      <button
        onClick={() => navigate('/admin/orders')}
        className="inline-flex items-center gap-1 text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-coral-deep)] mb-4"
      >
        <ChevronLeft size={16} aria-hidden="true" /> Back to orders
      </button>

      <AdminPageHeader title={order.orderNumber} description={`Placed ${formatDate(order.createdAt)}`} />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <AdminCard>
            <h2 className="font-semibold mb-4">Items</h2>
            <div className="space-y-3">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center gap-3">
                  {item.image && (
                    <img
                      src={item.image}
                      alt=""
                      loading="lazy"
                      className="h-12 w-12 rounded-lg object-cover bg-[var(--color-surface)]"
                    />
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-[var(--color-ink-soft)]">
                      {item.sku} · Qty {item.quantity} · {formatPrice(item.unitPrice, order.currency)} each
                    </p>
                  </div>
                  <p className="text-sm font-semibold">{formatPrice(item.lineTotal, order.currency)}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-[var(--color-line)] space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--color-ink-soft)]">Subtotal</span>
                <span>{formatPrice(order.subtotal, order.currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-ink-soft)]">Shipping</span>
                <span>{formatPrice(order.shippingCost, order.currency)}</span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between">
                  <span className="text-[var(--color-ink-soft)]">Discount</span>
                  <span>-{formatPrice(order.discount, order.currency)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold pt-1">
                <span>Total</span>
                <span>{formatPrice(order.total, order.currency)}</span>
              </div>
            </div>
          </AdminCard>

          <AdminCard>
            <h2 className="font-semibold mb-4">Update status</h2>
            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              <FormRow label="Status">
                <select
                  className="form-input"
                  value={pendingStatus || order.status}
                  onChange={(e) => setPendingStatus(e.target.value as OrderStatus)}
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </FormRow>
            </div>
            {(pendingStatus === 'shipped' || order.status === 'shipped') && (
              <div className="grid sm:grid-cols-2 gap-4 mb-4">
                <FormRow label="Tracking number">
                  <input
                    className="form-input"
                    defaultValue={order.tracking?.number ?? ''}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                  />
                </FormRow>
                <FormRow label="Carrier">
                  <input
                    className="form-input"
                    defaultValue={order.tracking?.carrier ?? ''}
                    onChange={(e) => setTrackingCarrier(e.target.value)}
                  />
                </FormRow>
              </div>
            )}
            <Button
              onClick={handleStatusUpdate}
              disabled={!pendingStatus || pendingStatus === order.status || updateStatus.isPending}
            >
              {updateStatus.isPending ? 'Updating…' : 'Update status'}
            </Button>
          </AdminCard>

          {order.history && order.history.length > 0 && (
            <AdminCard>
              <h2 className="font-semibold mb-4">History</h2>
              <ul className="space-y-3">
                {order.history.map((h) => (
                  <li key={h.id} className="text-sm">
                    <span className="font-medium">{STATUS_OPTIONS.find((s) => s.value === h.status)?.label ?? h.status}</span>
                    <span className="text-[var(--color-ink-soft)]"> · {formatDate(h.created_at)}</span>
                    {h.note && <p className="text-[var(--color-ink-soft)] mt-0.5">{h.note}</p>}
                  </li>
                ))}
              </ul>
            </AdminCard>
          )}
        </div>

        <div className="space-y-6">
          <AdminCard>
            <h2 className="font-semibold mb-3">Customer</h2>
            <p className="text-sm">{order.customer.name}</p>
            <p className="text-sm text-[var(--color-ink-soft)]">{order.customer.email}</p>
            {order.customer.phone && <p className="text-sm text-[var(--color-ink-soft)]">{order.customer.phone}</p>}
          </AdminCard>

          <AdminCard>
            <h2 className="font-semibold mb-3">Shipping address</h2>
            <p className="text-sm">{order.shipping.line1}</p>
            {order.shipping.line2 && <p className="text-sm">{order.shipping.line2}</p>}
            <p className="text-sm">
              {order.shipping.city}, {order.shipping.postalCode}
            </p>
            <p className="text-sm">{order.shipping.country}</p>
          </AdminCard>

          {order.customerNote && (
            <AdminCard>
              <h2 className="font-semibold mb-3">Customer note</h2>
              <p className="text-sm text-[var(--color-ink-soft)]">{order.customerNote}</p>
            </AdminCard>
          )}

          <AdminCard>
            <h2 className="font-semibold mb-3">Internal note</h2>
            <p className="text-xs text-[var(--color-ink-soft)] mb-2">Only visible to admins, never shown to the customer.</p>
            <textarea
              rows={4}
              className="form-input mb-3"
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => id && updateNote.mutate({ id, adminNote })}
              disabled={updateNote.isPending}
            >
              {updateNote.isPending ? 'Saving…' : 'Save note'}
            </Button>
          </AdminCard>
        </div>
      </div>
    </div>
  );
}
