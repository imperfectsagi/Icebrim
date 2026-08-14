import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { AdminPageHeader, FormRow } from '../components/AdminUi';
import { AdminModal } from '../components/AdminModal';
import { DataTable } from '../components/DataTable';
import { Badge } from '@/components/ui/primitives';
import { Button } from '@/components/ui/Button';
import { useAdminCoupons, useCreateCoupon, useUpdateCoupon, useDeleteCoupon, type CouponInput } from '../hooks/useAdminCoupons';
import type { Coupon } from '@/types/cms';
import { formatDate } from '@/lib/utils';

type FormState = {
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: string;
  active: boolean;
  expiresAt: string; // yyyy-mm-dd from <input type="date">, or ''
  usageLimit: string; // numeric string, or ''
  minOrderSubtotal: string; // decimal string, or ''
};

const EMPTY_FORM: FormState = {
  code: '',
  discountType: 'percentage',
  discountValue: '',
  active: true,
  expiresAt: '',
  usageLimit: '',
  minOrderSubtotal: '',
};

function couponToForm(c: Coupon): FormState {
  return {
    code: c.code,
    discountType: c.discountType,
    discountValue: String(c.discountValue),
    active: c.active,
    expiresAt: c.expiresAt ? c.expiresAt.slice(0, 10) : '',
    usageLimit: c.usageLimit != null ? String(c.usageLimit) : '',
    minOrderSubtotal: c.minOrderSubtotal != null ? String(c.minOrderSubtotal) : '',
  };
}

function formToInput(f: FormState): CouponInput {
  return {
    code: f.code.trim(),
    discountType: f.discountType,
    discountValue: Number(f.discountValue),
    active: f.active,
    expiresAt: f.expiresAt ? new Date(`${f.expiresAt}T23:59:59`).toISOString() : null,
    usageLimit: f.usageLimit ? Number(f.usageLimit) : null,
    minOrderSubtotal: f.minOrderSubtotal ? Number(f.minOrderSubtotal) : null,
  };
}

export function AdminCouponsPage() {
  const { data: coupons, isLoading } = useAdminCoupons();
  const createCoupon = useCreateCoupon();
  const updateCoupon = useUpdateCoupon();
  const deleteCoupon = useDeleteCoupon();

  const [editingCoupon, setEditingCoupon] = useState<Coupon | 'new' | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormError(null);
    setEditingCoupon('new');
  };
  const openEdit = (c: Coupon) => {
    setForm(couponToForm(c));
    setFormError(null);
    setEditingCoupon(c);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!form.code.trim()) return setFormError('Enter a coupon code.');
    if (!form.discountValue || Number(form.discountValue) <= 0) return setFormError('Enter a discount value greater than 0.');
    if (form.discountType === 'percentage' && Number(form.discountValue) > 100) {
      return setFormError('Percentage discount cannot exceed 100.');
    }

    try {
      if (editingCoupon === 'new') {
        await createCoupon.mutateAsync(formToInput(form));
      } else if (editingCoupon) {
        await updateCoupon.mutateAsync({ id: editingCoupon.id, ...formToInput(form) });
      }
      setEditingCoupon(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save this coupon.');
    }
  };

  return (
    <div>
      <AdminPageHeader
        title="Coupons"
        description="Create and manage discount codes customers can apply at checkout."
        action={{ label: 'Add Coupon', onClick: openCreate }}
      />

      {isLoading ? (
        <p className="text-sm text-[var(--color-ink-soft)]">Loading…</p>
      ) : (
        <DataTable
          rows={coupons ?? []}
          emptyMessage="No coupons yet. Add one to offer a discount at checkout."
          columns={[
            { header: 'Code', accessor: (c) => <span className="font-mono font-medium">{c.code}</span> },
            {
              header: 'Discount',
              accessor: (c) => (c.discountType === 'percentage' ? `${c.discountValue}%` : `£${c.discountValue.toFixed(2)}`),
            },
            {
              header: 'Status',
              accessor: (c) => <Badge tone={c.active ? 'ice' : 'coral'}>{c.active ? 'Active' : 'Disabled'}</Badge>,
            },
            {
              header: 'Usage',
              accessor: (c) => (c.usageLimit != null ? `${c.usedCount} / ${c.usageLimit}` : `${c.usedCount} (unlimited)`),
            },
            {
              header: 'Expires',
              accessor: (c) => (c.expiresAt ? formatDate(c.expiresAt) : 'Never'),
            },
          ]}
          rowActions={(c) => (
            <div className="flex items-center gap-1 justify-end">
              <button
                onClick={() => openEdit(c)}
                aria-label={`Edit ${c.code}`}
                className="p-2 rounded-lg hover:bg-[var(--color-surface)]"
              >
                <Pencil size={15} />
              </button>
              <button
                onClick={() => setConfirmDeleteId(c.id)}
                aria-label={`Delete ${c.code}`}
                className="p-2 rounded-lg hover:bg-[var(--color-coral-tint)] text-[var(--color-coral-deep)]"
              >
                <Trash2 size={15} />
              </button>
            </div>
          )}
        />
      )}

      {editingCoupon && (
        <AdminModal title={editingCoupon === 'new' ? 'Add coupon' : 'Edit coupon'} onClose={() => setEditingCoupon(null)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormRow label="Coupon code" hint="Customers enter this at checkout. Not case-sensitive.">
              <input
                className="form-input font-mono uppercase"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="WELCOME10"
              />
            </FormRow>

            <div className="grid grid-cols-2 gap-4">
              <FormRow label="Discount type">
                <select
                  className="form-input"
                  value={form.discountType}
                  onChange={(e) => setForm((f) => ({ ...f, discountType: e.target.value as 'percentage' | 'fixed' }))}
                >
                  <option value="percentage">Percentage</option>
                  <option value="fixed">Fixed amount (£)</option>
                </select>
              </FormRow>
              <FormRow label={form.discountType === 'percentage' ? 'Discount (%)' : 'Discount (£)'}>
                <input
                  type="number"
                  min="0"
                  max={form.discountType === 'percentage' ? 100 : undefined}
                  step={form.discountType === 'percentage' ? '1' : '0.01'}
                  className="form-input"
                  value={form.discountValue}
                  onChange={(e) => setForm((f) => ({ ...f, discountValue: e.target.value }))}
                />
              </FormRow>
            </div>

            <FormRow label="Status">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                />
                Active (customers can use this code)
              </label>
            </FormRow>

            <div className="grid grid-cols-2 gap-4">
              <FormRow label="Expiry date (optional)">
                <input
                  type="date"
                  className="form-input"
                  value={form.expiresAt}
                  onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
                />
              </FormRow>
              <FormRow label="Usage limit (optional)" hint="Total number of times this code can be used across all orders.">
                <input
                  type="number"
                  min="1"
                  className="form-input"
                  value={form.usageLimit}
                  onChange={(e) => setForm((f) => ({ ...f, usageLimit: e.target.value }))}
                  placeholder="Unlimited"
                />
              </FormRow>
            </div>

            <FormRow label="Minimum order amount (£, optional)" hint="Order subtotal must reach this amount for the coupon to apply.">
              <input
                type="number"
                min="0"
                step="0.01"
                className="form-input"
                value={form.minOrderSubtotal}
                onChange={(e) => setForm((f) => ({ ...f, minOrderSubtotal: e.target.value }))}
                placeholder="No minimum"
              />
            </FormRow>

            {formError && (
              <p role="alert" className="text-sm text-[var(--color-coral-deep)]">
                {formError}
              </p>
            )}

            <div className="flex items-center gap-2">
              <Button type="submit" size="sm" disabled={createCoupon.isPending || updateCoupon.isPending}>
                {createCoupon.isPending || updateCoupon.isPending ? 'Saving…' : 'Save coupon'}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditingCoupon(null)}>
                Cancel
              </Button>
            </div>
          </form>
        </AdminModal>
      )}

      {confirmDeleteId && (
        <ConfirmDeleteDialog
          onCancel={() => setConfirmDeleteId(null)}
          onConfirm={() => {
            deleteCoupon.mutate(confirmDeleteId);
            setConfirmDeleteId(null);
          }}
        />
      )}
    </div>
  );
}

function ConfirmDeleteDialog({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  return (
    <div role="alertdialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-[var(--radius-card)] p-6 max-w-sm w-full">
        <h2 className="font-semibold mb-2">Delete this coupon?</h2>
        <p className="text-sm text-[var(--color-ink-soft)] mb-6">
          Customers will no longer be able to use this code. Orders that already used it keep their
          discount. This action cannot be undone.
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
