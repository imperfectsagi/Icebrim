import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AdminPageHeader, AdminCard, FormRow } from '../components/AdminUi';
import { Button } from '@/components/ui/Button';
import { api, hasLiveApi } from '@/lib/api-client';

interface SeoSettings {
  siteTitle: string;
  siteTagline: string;
  defaultMetaDescription: string;
  googleAnalyticsId?: string;
  googleSiteVerification?: string;
  robotsTxtExtra?: string;
}

const seed: SeoSettings = {
  siteTitle: 'Icebrim',
  siteTagline: 'Cooling Relief Caps for Migraines & Menopause',
  defaultMetaDescription:
    'Icebrim makes reusable cooling comfort caps for migraines, tension headaches, and menopause hot flushes.',
};

let localSeoSettings = { ...seed };

const schema = z.object({
  siteTitle: z.string().min(1),
  siteTagline: z.string().min(1),
  defaultMetaDescription: z.string().min(1).max(160),
  googleAnalyticsId: z.string().optional(),
  googleSiteVerification: z.string().optional(),
  robotsTxtExtra: z.string().optional(),
});

export function AdminSeoSettingsPage() {
  const qc = useQueryClient();
  const { data: settings, isLoading } = useQuery<SeoSettings>({
    queryKey: ['admin', 'seo-settings'],
    queryFn: () => (hasLiveApi ? api.get('/api/admin/settings/seo') : Promise.resolve(localSeoSettings)),
  });

  const updateSettings = useMutation({
    mutationFn: (input: SeoSettings) =>
      hasLiveApi ? api.put('/api/admin/settings/seo', input) : Promise.resolve((localSeoSettings = input)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'seo-settings'] }),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SeoSettings>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (settings) reset(settings);
  }, [settings, reset]);

  if (isLoading) return <p className="text-sm text-[var(--color-ink-soft)]">Loading…</p>;

  return (
    <div>
      <AdminPageHeader title="SEO Settings" description="Sitewide defaults for search engines and analytics." />

      <form onSubmit={handleSubmit((v) => updateSettings.mutate(v))} noValidate className="space-y-6 max-w-xl">
        <AdminCard className="space-y-4">
          <FormRow label="Site title" error={errors.siteTitle?.message}>
            <input className="form-input" {...register('siteTitle')} />
          </FormRow>
          <FormRow label="Site tagline" error={errors.siteTagline?.message}>
            <input className="form-input" {...register('siteTagline')} />
          </FormRow>
          <FormRow label="Default meta description" error={errors.defaultMetaDescription?.message}>
            <textarea rows={2} className="form-input" {...register('defaultMetaDescription')} />
          </FormRow>
        </AdminCard>

        <AdminCard className="space-y-4">
          <h2 className="font-semibold">Analytics &amp; verification</h2>
          <FormRow label="Google Analytics ID" hint="e.g. G-XXXXXXXXXX">
            <input className="form-input" {...register('googleAnalyticsId')} />
          </FormRow>
          <FormRow label="Google Search Console verification code">
            <input className="form-input" {...register('googleSiteVerification')} />
          </FormRow>
        </AdminCard>

        <AdminCard className="space-y-4">
          <h2 className="font-semibold">robots.txt</h2>
          <FormRow label="Additional rules" hint="Appended to the generated robots.txt">
            <textarea rows={3} className="form-input" {...register('robotsTxtExtra')} />
          </FormRow>
        </AdminCard>

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save changes'}
        </Button>
      </form>
    </div>
  );
}
