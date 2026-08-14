import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useParams } from 'react-router-dom';
import { useEffect } from 'react';
import { AdminPageHeader, AdminCard, FormRow } from '../components/AdminUi';
import { Button } from '@/components/ui/Button';
import { RichTextEditor } from '../components/RichTextEditor';
import { useAdminPage, useCreatePage, useUpdatePage } from '../hooks/useAdminPages';
import { slugify } from '@/lib/slugify';

const schema = z.object({
  title: z.string().min(1, 'Title is required'),
  slug: z.string().min(1, 'URL slug is required').regex(/^[a-z0-9-]+$/, 'Use lowercase letters, numbers, and hyphens only'),
  contentHtml: z.string(),
  status: z.enum(['draft', 'published']),
  seoTitle: z.string().max(70),
  seoDescription: z.string().max(160),
});

type FormValues = z.infer<typeof schema>;

export function AdminPageFormPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const { data: existing, isLoading } = useAdminPage(isNew ? undefined : id);
  const createPage = useCreatePage();
  const updatePage = useUpdatePage();

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { status: 'draft', title: '', slug: '', contentHtml: '', seoTitle: '', seoDescription: '' },
  });

  useEffect(() => {
    if (existing) {
      reset({
        title: existing.title,
        slug: existing.slug,
        contentHtml: existing.contentHtml,
        status: existing.status,
        seoTitle: existing.seo.title,
        seoDescription: existing.seo.description,
      });
    }
  }, [existing, reset]);

  const onSubmit = async (values: FormValues) => {
    const payload = {
      title: values.title,
      slug: values.slug,
      contentHtml: values.contentHtml,
      status: values.status,
      seo: { title: values.seoTitle, description: values.seoDescription },
    };

    if (isNew) {
      await createPage.mutateAsync(payload);
    } else if (id) {
      await updatePage.mutateAsync({ id, ...payload });
    }
    navigate('/admin/pages');
  };

  if (!isNew && isLoading) return <p className="text-sm text-[var(--color-ink-soft)]">Loading…</p>;

  return (
    <div>
      <AdminPageHeader title={isNew ? 'Add Page' : 'Edit Page'} />

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6 max-w-3xl">
        <AdminCard className="space-y-4">
          <FormRow label="Title" error={errors.title?.message}>
            <input
              className="form-input"
              {...register('title')}
              onBlur={(e) => {
                register('title').onBlur(e);
                if (isNew && !watch('slug')) setValue('slug', slugify(e.target.value));
              }}
            />
          </FormRow>
          <FormRow label="URL slug" hint={`icebrim.com/pages/${watch('slug') || '...'}`} error={errors.slug?.message}>
            <input className="form-input" {...register('slug')} />
          </FormRow>
          <FormRow label="Status">
            <select className="form-input" {...register('status')}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </FormRow>
        </AdminCard>

        <AdminCard className="space-y-4">
          <h2 className="font-semibold">Content</h2>
          <Controller
            control={control}
            name="contentHtml"
            render={({ field }) => <RichTextEditor value={field.value} onChange={field.onChange} />}
          />
        </AdminCard>

        <AdminCard className="space-y-4">
          <h2 className="font-semibold">SEO (optional)</h2>
          <FormRow label="SEO meta title" hint="Falls back to the page title if left blank." error={errors.seoTitle?.message}>
            <input className="form-input" {...register('seoTitle')} />
          </FormRow>
          <FormRow label="SEO meta description" error={errors.seoDescription?.message}>
            <textarea rows={2} className="form-input" {...register('seoDescription')} />
          </FormRow>
        </AdminCard>

        <div className="flex gap-3">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : isNew ? 'Create page' : 'Save changes'}
          </Button>
          <Button type="button" variant="secondary" onClick={() => navigate('/admin/pages')}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
