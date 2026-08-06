import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { AdminPageHeader, AdminCard, FormRow } from '../components/AdminUi';
import { Button } from '@/components/ui/Button';
import { ImageUploadField } from '../components/ImageUploadField';
import { useAdminCompanySettings, useUpdateCompanySettings } from '../hooks/useAdminCompanySettings';

const schema = z.object({
  name: z.string().min(1, 'Company name is required'),
  legalName: z.string().min(1),
  aboutShort: z.string().min(1),
  address: z.string().min(1),
  phone: z.string().min(1),
  whatsapp: z.string().optional(),
  email: z.string().email('Enter a valid email'),
  googleMapsEmbedUrl: z.string().optional(),
  instagram: z.string().optional(),
  facebook: z.string().optional(),
  tiktok: z.string().optional(),
  footerNote: z.string().min(1),
  copyright: z.string().min(1),
  logoSrc: z.string().min(1, 'Logo is required'),
  businessHours: z.array(z.object({ day: z.string().min(1), hours: z.string().min(1) })),
});

type FormValues = z.infer<typeof schema>;

export function AdminCompanySettingsPage() {
  const { data: settings, isLoading } = useAdminCompanySettings();
  const updateSettings = useUpdateCompanySettings();

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const hoursArray = useFieldArray({ control, name: 'businessHours' });

  useEffect(() => {
    if (settings) {
      reset({
        name: settings.name,
        legalName: settings.legalName,
        aboutShort: settings.aboutShort,
        address: settings.address,
        phone: settings.phone,
        whatsapp: settings.whatsapp,
        email: settings.email,
        googleMapsEmbedUrl: settings.googleMapsEmbedUrl,
        instagram: settings.social.instagram,
        facebook: settings.social.facebook,
        tiktok: settings.social.tiktok,
        footerNote: settings.footerNote,
        copyright: settings.copyright,
        logoSrc: settings.logo.src,
        businessHours: settings.businessHours,
      });
    }
  }, [settings, reset]);

  const onSubmit = async (values: FormValues) => {
    await updateSettings.mutateAsync({
      name: values.name,
      legalName: values.legalName,
      aboutShort: values.aboutShort,
      address: values.address,
      phone: values.phone,
      whatsapp: values.whatsapp,
      email: values.email,
      googleMapsEmbedUrl: values.googleMapsEmbedUrl,
      social: { instagram: values.instagram, facebook: values.facebook, tiktok: values.tiktok },
      footerNote: values.footerNote,
      copyright: values.copyright,
      businessHours: values.businessHours,
      logo: { src: values.logoSrc, alt: values.name },
      logoIcon: { src: values.logoSrc, alt: values.name },
    });
  };

  if (isLoading) return <p className="text-sm text-[var(--color-ink-soft)]">Loading…</p>;

  return (
    <div>
      <AdminPageHeader title="Company Settings" description="Manage your company details shown across the site." />

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6 max-w-2xl">
        <AdminCard className="space-y-4">
          <h2 className="font-semibold">Logo</h2>
          <ImageUploadField value={watch('logoSrc')} onChange={(src) => setValue('logoSrc', src, { shouldValidate: true })} />
          {errors.logoSrc && <p className="text-xs text-[var(--color-coral-deep)]">{errors.logoSrc.message}</p>}
        </AdminCard>

        <AdminCard className="space-y-4">
          <h2 className="font-semibold">Company details</h2>
          <FormRow label="Company name" error={errors.name?.message}>
            <input className="form-input" {...register('name')} />
          </FormRow>
          <FormRow label="Legal name" error={errors.legalName?.message}>
            <input className="form-input" {...register('legalName')} />
          </FormRow>
          <FormRow label="About (short)" error={errors.aboutShort?.message}>
            <textarea rows={2} className="form-input" {...register('aboutShort')} />
          </FormRow>
          <FormRow label="Address" error={errors.address?.message}>
            <input className="form-input" {...register('address')} />
          </FormRow>
        </AdminCard>

        <AdminCard className="space-y-4">
          <h2 className="font-semibold">Contact</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <FormRow label="Phone" error={errors.phone?.message}>
              <input className="form-input" {...register('phone')} />
            </FormRow>
            <FormRow label="WhatsApp">
              <input className="form-input" {...register('whatsapp')} />
            </FormRow>
          </div>
          <FormRow label="Email" error={errors.email?.message}>
            <input type="email" className="form-input" {...register('email')} />
          </FormRow>
          <FormRow label="Google Maps embed URL">
            <input className="form-input" {...register('googleMapsEmbedUrl')} />
          </FormRow>
        </AdminCard>

        <AdminCard className="space-y-4">
          <h2 className="font-semibold">Social media</h2>
          <FormRow label="Instagram URL">
            <input className="form-input" {...register('instagram')} />
          </FormRow>
          <FormRow label="Facebook URL">
            <input className="form-input" {...register('facebook')} />
          </FormRow>
          <FormRow label="TikTok URL">
            <input className="form-input" {...register('tiktok')} />
          </FormRow>
        </AdminCard>

        <AdminCard className="space-y-4">
          <h2 className="font-semibold">Business hours</h2>
          {hoursArray.fields.map((field, i) => (
            <div key={field.id} className="flex items-center gap-3">
              <input className="form-input" placeholder="Day(s)" {...register(`businessHours.${i}.day`)} />
              <input className="form-input" placeholder="Hours" {...register(`businessHours.${i}.hours`)} />
              <button
                type="button"
                onClick={() => hoursArray.remove(i)}
                className="p-2 rounded-lg hover:bg-[var(--color-coral-tint)] text-[var(--color-coral-deep)]"
                aria-label="Remove"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => hoursArray.append({ day: '', hours: '' })}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-coral-deep)]"
          >
            <Plus size={15} /> Add row
          </button>
        </AdminCard>

        <AdminCard className="space-y-4">
          <h2 className="font-semibold">Footer</h2>
          <FormRow label="Footer note" error={errors.footerNote?.message}>
            <textarea rows={2} className="form-input" {...register('footerNote')} />
          </FormRow>
          <FormRow label="Copyright text" hint="Use {year} to insert the current year automatically" error={errors.copyright?.message}>
            <input className="form-input" {...register('copyright')} />
          </FormRow>
        </AdminCard>

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save changes'}
        </Button>
      </form>
    </div>
  );
}
