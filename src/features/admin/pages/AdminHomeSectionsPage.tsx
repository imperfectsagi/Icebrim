import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { AdminPageHeader, AdminCard, FormRow } from '../components/AdminUi';
import { Button } from '@/components/ui/Button';
import { ImageUploadField } from '../components/ImageUploadField';
import { useAdminHomeContent, useUpdateHomeContent } from '../hooks/useAdminHomeContent';
import type { HomePageContent } from '@/types/cms';

/**
 * Edits every remaining section of the Home page content blob that
 * didn't already have a dedicated admin editor (Hero/Banner has its own
 * page, see AdminBannerPage.tsx): How It Works, Why Icebrim, About
 * (home preview), Featured Products, Reviews, Blog, and the closing CTA
 * banner. Same read-whole-blob/write-whole-blob pattern as that page:
 * useAdminHomeContent() loads the full HomePageContent object, this form
 * edits every slice of it except hero, and useUpdateHomeContent() writes
 * the whole object back so hero (edited on its own page) is preserved
 * untouched.
 */
type FormValues = Omit<HomePageContent, 'hero' | 'seo'>;

export function AdminHomeSectionsPage() {
  const { data: content, isLoading } = useAdminHomeContent();
  const updateHomeContent = useUpdateHomeContent();

  const { control, register, handleSubmit, reset, formState: { isSubmitting } } = useForm<FormValues>({
    defaultValues: {
      howItWorks: { visible: true, eyebrow: '', heading: '', steps: [] },
      whyChooseUs: { visible: true, eyebrow: '', heading: '', features: [] },
      about: { visible: true, eyebrow: '', heading: '', body: '', image: { src: '', alt: '' } },
      featuredProducts: { visible: true, eyebrow: '', heading: '', productSlugs: [] },
      reviews: { visible: true, eyebrow: '', heading: '', maxDisplayed: 3 },
      blog: { visible: true, eyebrow: '', heading: '', maxDisplayed: 3 },
      cta: { visible: true, heading: '', description: '', cta: { label: '', href: '' }, image: { src: '', alt: '' } },
    },
  });

  useEffect(() => {
    if (content) {
      reset({
        howItWorks: content.howItWorks,
        whyChooseUs: content.whyChooseUs,
        about: content.about,
        featuredProducts: content.featuredProducts,
        reviews: content.reviews,
        blog: content.blog,
        cta: content.cta,
      });
    }
  }, [content, reset]);

  const stepsArray = useFieldArray({ control, name: 'howItWorks.steps' });
  const featuresArray = useFieldArray({ control, name: 'whyChooseUs.features' });

  const onSubmit = async (values: FormValues) => {
    if (!content) return;
    // Preserve hero and seo exactly as they currently are (hero has its
    // own editor on the Banner page) -- every other section is replaced
    // with what this form edited.
    await updateHomeContent.mutateAsync({ ...content, ...values });
  };

  if (isLoading || !content) return <p className="text-sm text-[var(--color-ink-soft)]">Loading…</p>;

  return (
    <div>
      <AdminPageHeader
        title="Home Sections"
        description="Edit every section of the home page below the hero banner (edit that under Admin → Banner) -- How It Works, Why Icebrim, About preview, Featured Products, Reviews, Blog, and the closing CTA banner. Each section can be shown or hidden independently."
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

        {/* ------------------------- Featured Products ------------------------ */}
        <AdminCard className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Featured Products</h2>
            <Controller
              control={control}
              name="featuredProducts.visible"
              render={({ field }) => (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="h-4 w-4" checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />
                  Show on home page
                </label>
              )}
            />
          </div>
          <p className="text-xs text-[var(--color-ink-soft)]">
            The products shown here always come from your live product catalog (Admin &rarr; Products) --
            only the section&apos;s heading text is editable here.
          </p>
          <FormRow label="Eyebrow">
            <input className="form-input" {...register('featuredProducts.eyebrow')} />
          </FormRow>
          <FormRow label="Heading">
            <input className="form-input" {...register('featuredProducts.heading')} />
          </FormRow>
        </AdminCard>

        {/* ----------------------------- Reviews ------------------------------ */}
        <AdminCard className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Reviews</h2>
            <Controller
              control={control}
              name="reviews.visible"
              render={({ field }) => (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="h-4 w-4" checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />
                  Show on home page
                </label>
              )}
            />
          </div>
          <p className="text-xs text-[var(--color-ink-soft)]">
            Shows your most recent approved reviews (Admin &rarr; Reviews). Only the heading text and
            how many to display are editable here.
          </p>
          <FormRow label="Eyebrow">
            <input className="form-input" {...register('reviews.eyebrow')} />
          </FormRow>
          <FormRow label="Heading">
            <input className="form-input" {...register('reviews.heading')} />
          </FormRow>
          <FormRow label="Number to display">
            <input
              type="number"
              min={1}
              max={12}
              className="form-input"
              {...register('reviews.maxDisplayed', { valueAsNumber: true })}
            />
          </FormRow>
        </AdminCard>

        {/* ------------------------------ Blog --------------------------------- */}
        <AdminCard className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Blog</h2>
            <Controller
              control={control}
              name="blog.visible"
              render={({ field }) => (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="h-4 w-4" checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />
                  Show on home page
                </label>
              )}
            />
          </div>
          <p className="text-xs text-[var(--color-ink-soft)]">
            Shows your most recent published posts (Admin &rarr; Blogs). Only the heading text and how
            many to display are editable here.
          </p>
          <FormRow label="Eyebrow">
            <input className="form-input" {...register('blog.eyebrow')} />
          </FormRow>
          <FormRow label="Heading">
            <input className="form-input" {...register('blog.heading')} />
          </FormRow>
          <FormRow label="Number to display">
            <input
              type="number"
              min={1}
              max={12}
              className="form-input"
              {...register('blog.maxDisplayed', { valueAsNumber: true })}
            />
          </FormRow>
        </AdminCard>

        {/* ------------------------- Closing CTA banner ------------------------ */}
        <AdminCard className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Closing CTA Banner</h2>
            <Controller
              control={control}
              name="cta.visible"
              render={({ field }) => (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="h-4 w-4" checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />
                  Show on home page
                </label>
              )}
            />
          </div>
          <p className="text-xs text-[var(--color-ink-soft)]">
            The full-width banner near the bottom of the home page, with a heading, short description,
            background image, and a single call-to-action button.
          </p>
          <FormRow label="Heading">
            <input className="form-input" {...register('cta.heading')} />
          </FormRow>
          <FormRow label="Description">
            <textarea rows={2} className="form-input" {...register('cta.description')} />
          </FormRow>
          <FormRow label="Button label">
            <input className="form-input" {...register('cta.cta.label')} />
          </FormRow>
          <FormRow label="Button link" hint="A path on this site (e.g. /products/cooling-relief-cap) or a full URL.">
            <input className="form-input" {...register('cta.cta.href')} />
          </FormRow>
          <FormRow label="Background image">
            <Controller
              control={control}
              name="cta.image.src"
              render={({ field }) => (
                <ImageUploadField accept="image" value={field.value} onChange={field.onChange} category="company" />
              )}
            />
          </FormRow>
          <FormRow label="Image alt text" hint="Describe the image for screen readers and SEO.">
            <input className="form-input" {...register('cta.image.alt')} />
          </FormRow>
        </AdminCard>

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save changes'}
        </Button>
      </form>
    </div>
  );
}
