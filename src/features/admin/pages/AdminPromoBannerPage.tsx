import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AdminPageHeader, AdminCard, FormRow } from '../components/AdminUi';
import { Button } from '@/components/ui/Button';
import { api, hasLiveApi } from '@/lib/api-client';
import type { PromoBannerContent } from '@/types/cms';

const seed: PromoBannerContent = { enabled: false, text: '', linkType: 'none', linkSlug: '' };
let localPromoBanner = { ...seed };

const schema = z.object({
  enabled: z.boolean(),
  text: z.string().max(200),
  linkType: z.enum(['none', 'product', 'page']),
  linkSlug: z.string().max(200),
}).refine((v) => v.linkType === 'none' || v.linkSlug.trim().length > 0, {
  message: 'Enter a slug for the link, or set the link type to "No link"',
  path: ['linkSlug'],
}).refine((v) => v.enabled === false || v.text.trim().length > 0, {
  message: 'Enter the banner text, or turn the banner off',
  path: ['text'],
});

type FormValues = z.infer<typeof schema>;

export function AdminPromoBannerPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<PromoBannerContent>({
    queryKey: ['admin', 'promo-banner'],
    queryFn: () => (hasLiveApi ? api.get('/api/admin/content/promo-banner') : Promise.resolve(localPromoBanner)),
  });

  const updateBanner = useMutation({
    mutationFn: (input: PromoBannerContent) =>
      hasLiveApi ? api.put<PromoBannerContent>('/api/admin/content/promo-banner', input) : Promise.resolve((localPromoBanner = input)),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['admin', 'promo-banner'] });
      // Refresh the public-facing banner immediately too, same pattern as
      // AdminBrandingPage does for the theme accent color.
      qc.setQueryData(['settings', 'promo-banner'], result);
    },
  });

  const {
    control,
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: seed });

  useEffect(() => {
    if (data) reset(data);
  }, [data, reset]);

  if (isLoading) return <p className="text-sm text-[var(--color-ink-soft)]">Loading…</p>;

  const linkType = watch('linkType');

  return (
    <div>
      <AdminPageHeader
        title="Promo Banner"
        description="A site-wide announcement strip shown above the header. Turn it on or off, edit the text, and optionally link it to a product or page."
      />

      <form onSubmit={handleSubmit((v) => updateBanner.mutate(v))} noValidate className="space-y-6 max-w-xl">
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
                Show promo banner on the site
              </label>
            )}
          />
        </AdminCard>

        <AdminCard className="space-y-4">
          <FormRow label="Banner text" error={errors.text?.message} hint="e.g. Free shipping this weekend only.">
            <input className="form-input" maxLength={200} {...register('text')} />
          </FormRow>

          <div>
            <label className="block text-sm font-medium mb-2">Link (optional)</label>
            <div className="flex items-center gap-4 text-sm mb-3">
              {(['none', 'product', 'page'] as const).map((opt) => (
                <label key={opt} className="flex items-center gap-1.5">
                  <input type="radio" value={opt} {...register('linkType')} className="h-3.5 w-3.5" />
                  {opt === 'none' ? 'No link' : opt === 'product' ? 'Product' : 'Page'}
                </label>
              ))}
            </div>
            {linkType !== 'none' && (
              <FormRow
                label={linkType === 'product' ? 'Product slug' : 'Page slug'}
                error={errors.linkSlug?.message}
                hint={
                  linkType === 'product'
                    ? 'e.g. cooling-relief-cap -- links to /products/cooling-relief-cap'
                    : 'e.g. shipping-info -- links to /pages/shipping-info'
                }
              >
                <input className="form-input" {...register('linkSlug')} />
              </FormRow>
            )}
          </div>
        </AdminCard>

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save changes'}
        </Button>
      </form>
    </div>
  );
}
