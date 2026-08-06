import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useEffect } from 'react';
import { AdminPageHeader, AdminCard, FormRow } from '../components/AdminUi';
import { Button } from '@/components/ui/Button';
import { ImageUploadField } from '../components/ImageUploadField';
import { useAdminHomeContent, useUpdateHomeContent } from '../hooks/useAdminHomeContent';

const schema = z.object({
  visible: z.boolean(),
  eyebrow: z.string().min(1),
  heading: z.string().min(1, 'Heading is required'),
  description: z.string().min(1, 'Description is required'),
  imageSrc: z.string().min(1, 'Banner image is required'),
  imageAlt: z.string().min(1, 'Alt text is required'),
  primaryLabel: z.string().min(1),
  primaryHref: z.string().min(1),
  secondaryLabel: z.string().optional(),
  secondaryHref: z.string().optional(),
  trustBadges: z.string(),
});

type FormValues = z.infer<typeof schema>;

export function AdminBannerPage() {
  const { data: content, isLoading } = useAdminHomeContent();
  const updateContent = useUpdateHomeContent();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (content) {
      reset({
        visible: content.hero.visible,
        eyebrow: content.hero.eyebrow,
        heading: content.hero.heading,
        description: content.hero.description,
        imageSrc: content.hero.image.src,
        imageAlt: content.hero.image.alt,
        primaryLabel: content.hero.primaryCta.label,
        primaryHref: content.hero.primaryCta.href,
        secondaryLabel: content.hero.secondaryCta?.label,
        secondaryHref: content.hero.secondaryCta?.href,
        trustBadges: content.hero.trustBadges.join(', '),
      });
    }
  }, [content, reset]);

  const onSubmit = async (values: FormValues) => {
    if (!content) return;
    await updateContent.mutateAsync({
      ...content,
      hero: {
        visible: values.visible,
        eyebrow: values.eyebrow,
        heading: values.heading,
        description: values.description,
        image: { src: values.imageSrc, alt: values.imageAlt },
        primaryCta: { label: values.primaryLabel, href: values.primaryHref },
        secondaryCta:
          values.secondaryLabel && values.secondaryHref
            ? { label: values.secondaryLabel, href: values.secondaryHref }
            : undefined,
        trustBadges: values.trustBadges.split(',').map((b) => b.trim()).filter(Boolean),
      },
    });
  };

  if (isLoading) return <p className="text-sm text-[var(--color-ink-soft)]">Loading…</p>;

  return (
    <div>
      <AdminPageHeader title="Banner" description="Manage the home page hero banner." />

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6 max-w-2xl">
        <AdminCard>
          <label className="flex items-center gap-2.5 text-sm font-medium">
            <input type="checkbox" className="h-4 w-4" {...register('visible')} />
            Show banner on home page
          </label>
        </AdminCard>

        <AdminCard className="space-y-4">
          <h2 className="font-semibold">Banner image</h2>
          <ImageUploadField value={watch('imageSrc')} onChange={(src) => setValue('imageSrc', src, { shouldValidate: true })} />
          {errors.imageSrc && <p className="text-xs text-[var(--color-coral-deep)]">{errors.imageSrc.message}</p>}
          <FormRow label="Image alt text" error={errors.imageAlt?.message}>
            <input className="form-input" {...register('imageAlt')} />
          </FormRow>
        </AdminCard>

        <AdminCard className="space-y-4">
          <h2 className="font-semibold">Text</h2>
          <FormRow label="Eyebrow text" error={errors.eyebrow?.message}>
            <input className="form-input" {...register('eyebrow')} />
          </FormRow>
          <FormRow label="Heading" error={errors.heading?.message}>
            <input className="form-input" {...register('heading')} />
          </FormRow>
          <FormRow label="Description" error={errors.description?.message}>
            <textarea rows={3} className="form-input" {...register('description')} />
          </FormRow>
          <FormRow label="Trust badges (comma separated)">
            <input className="form-input" {...register('trustBadges')} />
          </FormRow>
        </AdminCard>

        <AdminCard className="space-y-4">
          <h2 className="font-semibold">Buttons</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <FormRow label="Primary button text" error={errors.primaryLabel?.message}>
              <input className="form-input" {...register('primaryLabel')} />
            </FormRow>
            <FormRow label="Primary button link" error={errors.primaryHref?.message}>
              <input className="form-input" {...register('primaryHref')} />
            </FormRow>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <FormRow label="Secondary button text (optional)">
              <input className="form-input" {...register('secondaryLabel')} />
            </FormRow>
            <FormRow label="Secondary button link (optional)">
              <input className="form-input" {...register('secondaryHref')} />
            </FormRow>
          </div>
        </AdminCard>

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save changes'}
        </Button>
      </form>
    </div>
  );
}
