import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { AdminPageHeader, AdminCard, FormRow } from '../components/AdminUi';
import { Button } from '@/components/ui/Button';
import { ImageUploadField } from '../components/ImageUploadField';
import { useAdminHomeContent, useUpdateHomeContent } from '../hooks/useAdminHomeContent';
import type { HomePageContent } from '@/types/cms';

/**
 * Edits the Home page's How It Works, Why Icebrim, and About sections --
 * the remaining sections of the home content blob that didn't already
 * have a dedicated admin editor (Hero/Banner has its own page, see
 * AdminBannerPage.tsx). Same read-whole-blob/write-whole-blob pattern as
 * that page: useAdminHomeContent() loads the full HomePageContent object,
 * this form edits three slices of it, and useUpdateHomeContent() writes
 * the whole object back so the sections this page doesn't touch (hero,
 * featuredProducts, reviews, blog, cta) are preserved untouched.
 */
type FormValues = Pick<HomePageContent, 'howItWorks' | 'whyChooseUs' | 'about'>;

export function AdminHomeSectionsPage() {
  const { data: content, isLoading } = useAdminHomeContent();
  const updateHomeContent = useUpdateHomeContent();

  const { control, register, handleSubmit, reset, formState: { isSubmitting } } = useForm<FormValues>({
    defaultValues: {
      howItWorks: { visible: true, eyebrow: '', heading: '', steps: [] },
      whyChooseUs: { visible: true, eyebrow: '', heading: '', features: [] },
      about: { visible: true, eyebrow: '', heading: '', body: '', image: { src: '', alt: '' } },
    },
  });

  useEffect(() => {
    if (content) reset({ howItWorks: content.howItWorks, whyChooseUs: content.whyChooseUs, about: content.about });
  }, [content, reset]);

  const stepsArray = useFieldArray({ control, name: 'howItWorks.steps' });
  const featuresArray = useFieldArray({ control, name: 'whyChooseUs.features' });

  const onSubmit = async (values: FormValues) => {
    if (!content) return;
    // Preserve every other section of the blob (hero, featuredProducts,
    // reviews, blog, cta, seo) exactly as it currently is -- only the
    // three sections this form edits are replaced.
    await updateHomeContent.mutateAsync({ ...content, ...values });
  };

  if (isLoading || !content) return <p className="text-sm text-[var(--color-ink-soft)]">Loading…</p>;

  return (
    <div>
      <AdminPageHeader
        title="Home Sections"
        description="Edit the How It Works, Why Icebrim, and About sections shown on the home page. Each can be shown or hidden independently."
      />

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-8 max-w-3xl">
        {/* --------------------------- How It Works --------------------------- */}
        <AdminCard className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">How It Works</h2>
            <Controller
              control={control}
              name="howItWorks.visible"
              render={({ field }) => (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="h-4 w-4" checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />
                  Show on home page
                </label>
              )}
            />
          </div>
          <FormRow label="Eyebrow">
            <input className="form-input" {...register('howItWorks.eyebrow')} />
          </FormRow>
          <FormRow label="Heading">
            <input className="form-input" {...register('howItWorks.heading')} />
          </FormRow>
          <div className="space-y-3">
            <span className="text-sm font-medium">Steps</span>
            {stepsArray.fields.map((field, i) => (
              <div key={field.id} className="rounded-lg border border-[var(--color-line)] p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[var(--color-ink-soft)]">Step {i + 1}</span>
                  <button
                    type="button"
                    onClick={() => stepsArray.remove(i)}
                    aria-label={`Remove step ${i + 1}`}
                    className="text-[var(--color-coral-deep)]"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <input className="form-input" placeholder="Title" {...register(`howItWorks.steps.${i}.title` as const)} />
                <textarea rows={2} className="form-input" placeholder="Description" {...register(`howItWorks.steps.${i}.description` as const)} />
              </div>
            ))}
            <button
              type="button"
              onClick={() => stepsArray.append({ id: crypto.randomUUID(), title: '', description: '' })}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-coral-deep)]"
            >
              <Plus size={15} /> Add step
            </button>
          </div>
        </AdminCard>

        {/* --------------------------- Why Icebrim --------------------------- */}
        <AdminCard className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Why Icebrim</h2>
            <Controller
              control={control}
              name="whyChooseUs.visible"
              render={({ field }) => (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="h-4 w-4" checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />
                  Show on home page
                </label>
              )}
            />
          </div>
          <FormRow label="Eyebrow">
            <input className="form-input" {...register('whyChooseUs.eyebrow')} />
          </FormRow>
          <FormRow label="Heading">
            <input className="form-input" {...register('whyChooseUs.heading')} />
          </FormRow>
          <div className="space-y-3">
            <span className="text-sm font-medium">Features</span>
            {featuresArray.fields.map((field, i) => (
              <div key={field.id} className="rounded-lg border border-[var(--color-line)] p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[var(--color-ink-soft)]">Feature {i + 1}</span>
                  <button
                    type="button"
                    onClick={() => featuresArray.remove(i)}
                    aria-label={`Remove feature ${i + 1}`}
                    className="text-[var(--color-coral-deep)]"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <input className="form-input" placeholder="Title" {...register(`whyChooseUs.features.${i}.title` as const)} />
                <textarea rows={2} className="form-input" placeholder="Description" {...register(`whyChooseUs.features.${i}.description` as const)} />
              </div>
            ))}
            <button
              type="button"
              onClick={() => featuresArray.append({ id: crypto.randomUUID(), title: '', description: '' })}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-coral-deep)]"
            >
              <Plus size={15} /> Add feature
            </button>
          </div>
        </AdminCard>

        {/* ------------------------- Home About section ------------------------ */}
        <AdminCard className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">About (home page preview)</h2>
            <Controller
              control={control}
              name="about.visible"
              render={({ field }) => (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="h-4 w-4" checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />
                  Show on home page
                </label>
              )}
            />
          </div>
          <p className="text-xs text-[var(--color-ink-soft)]">
            This is the short About preview shown on the home page, separate from the full About
            page content (edit that under Admin &rarr; Pages &rarr; About).
          </p>
          <FormRow label="Eyebrow">
            <input className="form-input" {...register('about.eyebrow')} />
          </FormRow>
          <FormRow label="Heading">
            <input className="form-input" {...register('about.heading')} />
          </FormRow>
          <FormRow label="Body" hint="Plain text (shown as a short teaser paragraph). For rich formatting, use the full About page under Admin → Pages.">
            <textarea rows={4} className="form-input" {...register('about.body')} />
          </FormRow>
          <FormRow label="Image">
            <Controller
              control={control}
              name="about.image.src"
              render={({ field }) => (
                <ImageUploadField accept="image" value={field.value} onChange={field.onChange} category="company" />
              )}
            />
          </FormRow>
          <FormRow label="Image alt text" hint="Describe the image for screen readers and SEO.">
            <input className="form-input" {...register('about.image.alt')} />
          </FormRow>
        </AdminCard>

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save changes'}
        </Button>
      </form>
    </div>
  );
}
