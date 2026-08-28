import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AdminPageHeader, AdminCard, FormRow } from '../components/AdminUi';
import { Button } from '@/components/ui/Button';
import { api, hasLiveApi } from '@/lib/api-client';
import type { DeliveryInfoContent } from '@/types/cms';

const seed: DeliveryInfoContent = { enabled: false, text: '' };
let localDeliveryInfo = { ...seed };

const schema = z
  .object({
    enabled: z.boolean(),
    text: z.string().max(120),
  })
  .refine((v) => v.enabled === false || v.text.trim().length > 0, {
    message: 'Enter the delivery estimate text, or turn delivery info off',
    path: ['text'],
  });

type FormValues = z.infer<typeof schema>;

export function AdminDeliveryPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<DeliveryInfoContent>({
    queryKey: ['admin', 'delivery-info'],
    queryFn: () => (hasLiveApi ? api.get('/api/admin/content/delivery-info') : Promise.resolve(localDeliveryInfo)),
  });

  const updateDeliveryInfo = useMutation({
    mutationFn: (input: DeliveryInfoContent) =>
      hasLiveApi
        ? api.put<DeliveryInfoContent>('/api/admin/content/delivery-info', input)
        : Promise.resolve((localDeliveryInfo = input)),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['admin', 'delivery-info'] });
      // Refresh the public-facing value immediately too, same pattern as
      // AdminPromoBannerPage does for the promo banner.
      qc.setQueryData(['settings', 'delivery-info'], result);
    },
  });

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: seed });

  useEffect(() => {
    if (data) reset(data);
  }, [data, reset]);

  if (isLoading) return <p className="text-sm text-[var(--color-ink-soft)]">Loading…</p>;

  return (
    <div>
      <AdminPageHeader
        title="Delivery Info"
        description="The estimated delivery time shown to customers on the product page, checkout, and order confirmation/status. Turn it on or off, and edit the wording without a code change."
      />

      <form onSubmit={handleSubmit((v) => updateDeliveryInfo.mutate(v))} noValidate className="space-y-6 max-w-xl">
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
                Show estimated delivery time on the site
              </label>
            )}
          />
        </AdminCard>

        <AdminCard className="space-y-4">
          <FormRow
            label="Delivery estimate text"
            error={errors.text?.message}
            hint='e.g. "2–4 working days" or "3–5 working days"'
          >
            <input className="form-input" maxLength={120} placeholder="2–4 working days" {...register('text')} />
          </FormRow>
        </AdminCard>

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save changes'}
        </Button>
      </form>
    </div>
  );
}
