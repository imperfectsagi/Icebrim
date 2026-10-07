import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AdminPageHeader, AdminCard, FormRow } from '../components/AdminUi';
import { Button } from '@/components/ui/Button';
import { useAdminCoupons } from '../hooks/useAdminCoupons';
import { useAdminPopupOffer, useUpdatePopupOffer } from '../hooks/useAdminPopupOffer';
import type { PopupOfferAdminContent } from '@/types/cms';
import { formatPrice } from '@/lib/utils';

const seed: PopupOfferAdminContent = { enabled: false, heading: '', subheading: '', couponId: null };

const schema = z
  .object({
    enabled: z.boolean(),
    heading: z.string().max(150),
    subheading: z.string().max(300),
    couponId: z.string(), // '' means "none selected" -- coerced to null on submit
  })
  .refine((v) => v.enabled === false || v.heading.trim().length > 0, {
    message: 'Enter a heading, or turn the popup off',
    path: ['heading'],
  })
  .refine((v) => v.enabled === false || v.couponId.length > 0, {
    message: 'Select a coupon to show, or turn the popup off',
    path: ['couponId'],
  });

type FormValues = z.infer<typeof schema>;

/**
 * Requirements #1 and #3: admin controls for the customer offer popup.
 * Deliberately only exposes the four controls the brief asks for
 * (enable/disable, heading, subheading, which existing coupon to show)
 * -- see useAdminCoupons.ts for the same coupon list already used by
 * AdminCouponsPage.tsx, reused here rather than any new coupon-picking
 * logic, so "the same system must support different offers... by
 * changing the selected coupon" is just: create/edit a coupon on the
 * existing Coupons page, then pick it here.
 */
export function AdminPopupPage() {
  const { data, isLoading } = useAdminPopupOffer();
  const { data: coupons, isLoading: couponsLoading } = useAdminCoupons();
  const updatePopupOffer = useUpdatePopupOffer();

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { ...seed, couponId: '' },
  });

  useEffect(() => {
    if (data) reset({ ...data, couponId: data.couponId ?? '' });
  }, [data, reset]);

  if (isLoading) return <p className="text-sm text-[var(--color-ink-soft)]">Loading…</p>;

  const activeCoupons = (coupons ?? []).filter((c) => c.active);

  const onSubmit = (values: FormValues) => {
    updatePopupOffer.mutate({
      enabled: values.enabled,
      heading: values.heading,
      subheading: values.subheading,
      couponId: values.couponId || null,
    });
  };

  return (
    <div>
      <AdminPageHeader
        title="Offer Popup"
        description="A promotional popup shown when the site loads. Collects an email, then reveals an existing coupon."
      />

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6 max-w-xl">
        <AdminCard>
          <Controller
            control={control}
            name="enabled"
            render={({ field }) => (
              <label className="flex items-center gap-2.5 text-sm font-medium">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={field.value}
                  onChange={(e) => field.onChange(e.target.checked)}
                />
                Show the offer popup on the site
              </label>
            )}
          />
        </AdminCard>

        <AdminCard className="space-y-4">
          <FormRow label="Popup heading" error={errors.heading?.message} hint="e.g. Get 10% off your first order">
            <input className="form-input" maxLength={150} {...register('heading')} />
          </FormRow>
          <FormRow
            label="Popup subheading / message"
            error={errors.subheading?.message}
            hint="e.g. Sign up and we'll email you a code right away."
          >
            <textarea rows={2} className="form-input" maxLength={300} {...register('subheading')} />
          </FormRow>
        </AdminCard>

        <AdminCard className="space-y-4">
          <FormRow
            label="Coupon to show after signup"
            error={errors.couponId?.message}
            hint={
              activeCoupons.length === 0
                ? 'No active coupons yet — create one on the Coupons page first.'
                : 'Only active coupons are listed. The same coupon also appears at checkout as the promotional offer.'
            }
          >
            <select className="form-input" disabled={couponsLoading} {...register('couponId')}>
              <option value="">Select a coupon…</option>
              {activeCoupons.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.discountType === 'percentage' ? `${c.discountValue}% off` : `${formatPrice(c.discountValue)} off`}
                </option>
              ))}
            </select>
          </FormRow>
          <p className="text-xs text-[var(--color-ink-soft)]">
            Need a different offer (welcome, festival, promotional)? Create or edit a coupon on the{' '}
            <Link to="/admin/coupons" className="underline hover:text-[var(--color-ink)]">
              Coupons
            </Link>{' '}
            page, then select it here.
          </p>
        </AdminCard>

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save changes'}
        </Button>
      </form>
    </div>
  );
}
