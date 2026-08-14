import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminPageHeader } from '../components/AdminUi';
import { DataTable } from '../components/DataTable';
import { useAdminOrders } from '../hooks/useAdminOrders';
import { formatPrice, formatDate, cn } from '@/lib/utils';
import type { OrderStatus } from '@/types/cms';

const STATUS_TABS: { value: OrderStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending_payment', label: 'Awaiting payment' },
  { value: 'paid', label: 'Paid' },
  { value: 'processing', label: 'Processing' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'refunded', label: 'Refunded' },
  { value: 'payment_failed', label: 'Payment failed' },
];

const STATUS_TONE: Record<OrderStatus, string> = {
  pending_payment: 'bg-[var(--color-surface-alt)] text-[var(--color-ink-soft)]',
  paid: 'bg-[var(--color-coral-tint)] text-[var(--color-coral-deep)]',
  processing: 'bg-[var(--color-coral-tint)] text-[var(--color-coral-deep)]',
  shipped: 'bg-blue-50 text-blue-700',
  delivered: 'bg-green-50 text-green-700',
  cancelled: 'bg-[var(--color-surface-alt)] text-[var(--color-ink-soft)]',
  refunded: 'bg-[var(--color-surface-alt)] text-[var(--color-ink-soft)]',
  payment_failed: 'bg-red-50 text-red-700',
};

export function AdminOrdersPage() {
  const [status, setStatus] = useState<OrderStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const { data: orders, isLoading } = useAdminOrders({ status, search });
  const navigate = useNavigate();

  return (
    <div>
      <AdminPageHeader title="Orders" description="View and manage customer orders." />

      <div className="flex flex-wrap gap-1.5 mb-4" role="tablist" aria-label="Filter by status">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            role="tab"
            type="button"
            aria-selected={status === tab.value}
            onClick={() => setStatus(tab.value)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-semibold transition-colors',
              status === tab.value
                ? 'bg-[var(--color-coral-tint)] text-[var(--color-coral-deep)]'
                : 'text-[var(--color-ink-soft)] hover:bg-[var(--color-surface-alt)]',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by order number, name, or email…"
        className="form-input mb-5 max-w-sm"
        aria-label="Search orders"
      />

      {isLoading ? (
        <p className="text-sm text-[var(--color-ink-soft)]">Loading…</p>
      ) : (
        <DataTable
          rows={orders ?? []}
          emptyMessage="No orders found."
          onRowClick={(order) => navigate(`/admin/orders/${order.id}`)}
          columns={[
            {
              header: 'Order',
              accessor: (o) => (
                <div>
                  <p className="font-medium">{o.orderNumber}</p>
                  <p className="text-xs text-[var(--color-ink-soft)]">{formatDate(o.createdAt)}</p>
                </div>
              ),
            },
            {
              header: 'Customer',
              accessor: (o) => (
                <div>
                  <p>{o.customer.name}</p>
                  <p className="text-xs text-[var(--color-ink-soft)]">{o.customer.email}</p>
                </div>
              ),
            },
            { header: 'Items', accessor: (o) => o.items.reduce((sum, i) => sum + i.quantity, 0) },
            { header: 'Total', accessor: (o) => formatPrice(o.total, o.currency) },
            {
              header: 'Status',
              accessor: (o) => (
                <span className={cn('inline-block px-2.5 py-1 rounded-full text-xs font-semibold', STATUS_TONE[o.status])}>
                  {STATUS_TABS.find((t) => t.value === o.status)?.label ?? o.status}
                </span>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
