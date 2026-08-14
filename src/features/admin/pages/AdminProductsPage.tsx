import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
import { AdminPageHeader } from '../components/AdminUi';
import { DataTable } from '../components/DataTable';
import { useAdminProducts, useDeleteProduct } from '../hooks/useAdminProducts';
import { formatPrice } from '@/lib/utils';
import { Badge } from '@/components/ui/primitives';

export function AdminProductsPage() {
  const { data: products, isLoading } = useAdminProducts();
  const deleteProduct = useDeleteProduct();
  const navigate = useNavigate();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  return (
    <div>
      <AdminPageHeader
        title="Products"
        description="Manage the products shown in your store."
        action={{ label: 'Add Product', onClick: () => navigate('/admin/products/new') }}
      />

      {isLoading ? (
        <p className="text-sm text-[var(--color-ink-soft)]">Loading…</p>
      ) : (
        <DataTable
          rows={products ?? []}
          emptyMessage="No products yet. Click 'Add Product' to create one."
          columns={[
            {
              header: 'Product',
              accessor: (p) => (
                <div className="flex items-center gap-3">
                  <img
                    src={p.images[0]?.src}
                    alt=""
                    loading="lazy"
                    className="h-10 w-10 rounded-lg object-cover bg-[var(--color-surface)]"
                  />
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-[var(--color-ink-soft)]">{p.sku}</p>
                  </div>
                </div>
              ),
            },
            { header: 'Category', accessor: (p) => p.category },
            {
              header: 'Price',
              accessor: (p) => (
                <div>
                  <span>{formatPrice(p.offerPrice ?? p.price, p.currency)}</span>
                  {p.offerPrice && (
                    <span className="text-xs text-[var(--color-ink-soft)] line-through ml-2">
                      {formatPrice(p.price, p.currency)}
                    </span>
                  )}
                </div>
              ),
            },
            { header: 'Stock', accessor: (p) => p.stock },
            {
              header: 'Status',
              accessor: (p) => (
                <Badge tone={p.published ? 'ice' : 'coral'}>{p.published ? 'Published' : 'Draft'}</Badge>
              ),
            },
          ]}
          rowActions={(p) => (
            <div className="flex items-center gap-1 justify-end">
              <button
                onClick={() => navigate(`/admin/products/${p.id}`)}
                aria-label={`Edit ${p.name}`}
                className="p-2 rounded-lg hover:bg-[var(--color-surface)]"
              >
                <Pencil size={15} />
              </button>
              <button
                onClick={() => setConfirmId(p.id)}
                aria-label={`Delete ${p.name}`}
                className="p-2 rounded-lg hover:bg-[var(--color-coral-tint)] text-[var(--color-coral-deep)]"
              >
                <Trash2 size={15} />
              </button>
            </div>
          )}
        />
      )}

      {confirmId && (
        <ConfirmDeleteDialog
          onCancel={() => setConfirmId(null)}
          onConfirm={() => {
            deleteProduct.mutate(confirmId);
            setConfirmId(null);
          }}
        />
      )}
    </div>
  );
}

function ConfirmDeleteDialog({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="bg-white rounded-[var(--radius-card)] p-6 max-w-sm w-full">
        <h2 className="font-semibold mb-2">Delete this product?</h2>
        <p className="text-sm text-[var(--color-ink-soft)] mb-6">
          This action cannot be undone. The product will be removed from the store immediately.
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-full text-sm font-medium border border-[var(--color-line)]"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-full text-sm font-medium bg-[var(--color-coral-deep)] text-white"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
