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
  mediaType: z.enum(['image', 'video', 'gif']),
  imageSrc: z.string(),
  imageMobileSrc: z.string(),
  imageAlt: z.string().min(1, 'Alt text is required'),
  videoSrc: z.string(),
  primaryLabel: z.string().min(1),
  primaryHref: z.string().min(1),
  secondaryLabel: z.string().optional(),
  secondaryHref: z.string().optional(),
  trustBadges: z.string(),
  textColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Enter a hex color like #1a2b2c').optional().or(z.literal('')),
}).refine((v) => (v.mediaType === 'video' ? v.videoSrc.length > 0 : v.imageSrc.length > 0), {
  message: 'A banner file is required',
  path: ['imageSrc'],
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
        mediaType: content.hero.mediaType ?? 'image',
        imageSrc: content.hero.image.src,
        imageMobileSrc: content.hero.image.mobileSrc ?? '',
        imageAlt: content.hero.image.alt,
        videoSrc: content.hero.videoSrc ?? '',
        primaryLabel: content.hero.primaryCta.label,
        primaryHref: content.hero.primaryCta.href,
        secondaryLabel: content.hero.secondaryCta?.label,
        secondaryHref: content.hero.secondaryCta?.href,
        trustBadges: content.hero.trustBadges.join(', '),
        textColor: content.hero.textColor ?? '',
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
        mediaType: values.mediaType,
        image: {
          src: values.imageSrc,
          mobileSrc: values.imageMobileSrc || undefined,
          alt: values.imageAlt,
        },
        videoSrc: values.mediaType === 'video' ? values.videoSrc : undefined,
        primaryCta: { label: values.primaryLabel, href: values.primaryHref },
        secondaryCta:
          values.secondaryLabel && values.secondaryHref
            ? { label: values.secondaryLabel, href: values.secondaryHref }
            : undefined,
        trustBadges: values.trustBadges.split(',').map((b) => b.trim()).filter(Boolean),
        textColor: values.textColor || undefined,
      },
    });
  };

  if (isLoading) return <p className="text-sm text-[var(--color-ink-soft)]">Loading…</p>;

  const mediaType = watch('mediaType');

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
          <h2 className="font-semibold">Banner media</h2>

          <div className="flex items-center gap-4 text-sm">
            {(['image', 'video', 'gif'] as const).map((opt) => (
              <label key={opt} className="flex items-center gap-1.5">
                <input type="radio" value={opt} {...register('mediaType')} className="h-3.5 w-3.5" />
                {opt === 'image' ? 'Image' : opt === 'video' ? 'Video' : 'GIF'}
              </label>
            ))}
          </div>

          {mediaType === 'video' ? (
            <>
              <ImageUploadField
                accept="image+video"
                mediaType="video"
                value={watch('videoSrc')}
                onChange={(src) => setValue('videoSrc', src, { shouldValidate: true })}
                category="hero-media"
              />
              <p className="text-xs text-[var(--color-ink-soft)]">
                Video plays muted and looped, no sound needed. Keep it short (a few seconds) and under 15MB so the
                home page still loads fast — see DEPLOYMENT.md for compression tips.
              </p>
              <FormRow label="Poster image (optional)" hint="Shown while the video loads, and as a fallback.">
                <ImageUploadField
                  value={watch('imageSrc')}
                  onChange={(src) => setValue('imageSrc', src, { shouldValidate: true })}
                  category="hero-media"
                />
              </FormRow>
            </>
          ) : (
            <>
              <FormRow label="Desktop image">
                <ImageUploadField
                  accept="image+video"
                  mediaType={mediaType === 'gif' ? 'gif' : 'image'}
                  value={watch('imageSrc')}
                  onChange={(src) => setValue('imageSrc', src, { shouldValidate: true })}
                  category="hero-media"
                />
              </FormRow>
              <FormRow
                label="Mobile image (optional)"
                hint="Composed specifically for narrow screens -- not just the desktop image cropped. If left empty, mobile visitors see the desktop image (which may crop poorly on narrow screens)."
              >
                <ImageUploadField
                  value={watch('imageMobileSrc')}
                  onChange={(src) => setValue('imageMobileSrc', src, { shouldValidate: true })}
                  category="hero-media"
                />
              </FormRow>
            </>
          )}
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
          <FormRow
            label="Text color (optional)"
            hint="Applies to the eyebrow, heading, and description above. Leave blank to use the site's default text colors."
            error={errors.textColor?.message}
          >
            <div className="flex items-center gap-3">
              <input
                type="color"
                className="h-10 w-14 rounded-lg border border-[var(--color-line)] cursor-pointer"
                value={watch('textColor') || '#1c1c1c'}
                onChange={(e) => setValue('textColor', e.target.value, { shouldValidate: true })}
                aria-label="Pick banner text color"
              />
              <input
                className="form-input flex-1"
                placeholder="#1c1c1c"
                {...register('textColor')}
              />
              {watch('textColor') && (
                <button
                  type="button"
                  onClick={() => setValue('textColor', '', { shouldValidate: true })}
                  className="text-sm font-medium text-[var(--color-coral-deep)] whitespace-nowrap"
                >
                  Reset to default
                </button>
              )}
            </div>
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
