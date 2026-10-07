import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { AdminPageHeader, AdminCard, FormRow } from '../components/AdminUi';
import { Button } from '@/components/ui/Button';
import { ImageUploadField } from '../components/ImageUploadField';
import { RichTextEditor } from '../components/RichTextEditor';
import { useAdminBlogPosts, useCreateBlogPost, useUpdateBlogPost } from '../hooks/useAdminBlog';
import { slugify } from '@/lib/slugify';

const schema = z.object({
  title: z.string().min(3, 'Title is required'),
  slug: z.string().min(2, 'URL slug is required').regex(/^[a-z0-9-]+$/, 'Use lowercase letters, numbers, and hyphens only'),
  excerpt: z.string().min(10, 'Add a short excerpt').max(300),
  contentHtml: z.string().min(20, 'Add some content'),
  featuredMediaType: z.enum(['image', 'video', 'gif']),
  featuredImageSrc: z.string(),
  featuredImageAlt: z.string().min(1, 'Add alt text for the featured media'),
  featuredVideoSrc: z.string(),
  category: z.string().min(1, 'Category is required'),
  tags: z.string(),
  author: z.string().min(1, 'Author is required'),
  status: z.enum(['draft', 'published']),
  seoTitle: z.string().min(3, 'SEO title is required').max(70),
  seoDescription: z.string().min(10, 'SEO description is required').max(160),
}).refine((v) => (v.featuredMediaType === 'video' ? v.featuredVideoSrc.length > 0 : v.featuredImageSrc.length > 0), {
  message: 'Add a featured image, GIF, or video',
  path: ['featuredImageSrc'],
});

type FormValues = z.infer<typeof schema>;

export function AdminBlogFormPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const { data: posts, isLoading: postsLoading } = useAdminBlogPosts();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const createPost = useCreateBlogPost();
  const updatePost = useUpdateBlogPost();
  const existing = !isNew ? posts?.find((p) => p.id === id) : undefined;

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
    defaultValues: { status: 'draft', author: 'Icebrim Team', featuredMediaType: 'image', featuredImageSrc: '', featuredVideoSrc: '' },
  });

  useEffect(() => {
    if (existing) {
      reset({
        title: existing.title,
        slug: existing.slug,
        excerpt: existing.excerpt,
        contentHtml: existing.contentHtml,
        featuredMediaType: existing.featuredMediaType ?? 'image',
        featuredImageSrc: existing.featuredImage.src,
        featuredImageAlt: existing.featuredImage.alt,
        featuredVideoSrc: existing.featuredVideoSrc ?? '',
        category: existing.category,
        tags: existing.tags.join(', '),
        author: existing.author,
        status: existing.status,
        seoTitle: existing.seo.title,
        seoDescription: existing.seo.description,
      });
    }
  }, [existing, reset]);

  const onSubmit = async (values: FormValues) => {
    setSubmitError(null);
    const payload = {
      title: values.title.trim(),
      slug: values.slug,
      excerpt: values.excerpt.trim(),
      contentHtml: values.contentHtml,
      featuredImage: { src: values.featuredImageSrc, alt: values.featuredImageAlt.trim() },
      featuredMediaType: values.featuredMediaType,
      // Always send the field so switching a post from Video back to
      // Image/GIF clears the old clip instead of leaving it behind.
      featuredVideoSrc: values.featuredMediaType === 'video' ? values.featuredVideoSrc : '',
      category: values.category.trim(),
      tags: values.tags.split(',').map((t) => t.trim()).filter(Boolean),
      author: values.author.trim(),
      status: values.status,
      // The server stamps the real publish time when a draft goes live.
      publishedAt: existing?.publishedAt ?? new Date().toISOString(),
      seo: { title: values.seoTitle.trim(), description: values.seoDescription.trim() },
    };

    try {
      if (isNew) {
        await createPost.mutateAsync(payload);
      } else if (id) {
        await updatePost.mutateAsync({ id, ...payload });
      }
      navigate('/admin/blogs');
    } catch (err) {
      // Show the server's reason (e.g. "A post with this URL slug already
      // exists") instead of failing silently.
      setSubmitError(err instanceof Error ? err.message : 'Could not save the post. Please try again.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (!isNew && postsLoading) return <p className="text-sm text-[var(--color-ink-soft)]">Loading…</p>;
  if (!isNew && !postsLoading && !existing) {
    return (
      <div>
        <AdminPageHeader title="Edit Blog Post" />
        <p className="text-sm text-[var(--color-ink-soft)] mb-4">This post could not be found. It may have been deleted.</p>
        <Button type="button" variant="secondary" onClick={() => navigate('/admin/blogs')}>
          Back to posts
        </Button>
      </div>
    );
  }

  return (
    <div>
      <AdminPageHeader title={isNew ? 'Add Blog Post' : 'Edit Blog Post'} />

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6 max-w-3xl">
        {submitError && (
          <div role="alert" className="rounded-xl border border-[var(--color-coral-deep)] bg-[var(--color-coral-tint)] px-4 py-3 text-sm text-[var(--color-coral-deep)]">
            {submitError}
          </div>
        )}
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
          <FormRow label="URL slug" hint={`icebrim.com/blog/${watch('slug') || '...'}`} error={errors.slug?.message}>
            <input className="form-input" {...register('slug')} />
          </FormRow>
          <FormRow label="Excerpt" hint={`${(watch('excerpt') ?? '').length}/300 — shown on blog cards`} error={errors.excerpt?.message}>
            <textarea rows={2} className="form-input" {...register('excerpt')} />
          </FormRow>
        </AdminCard>

        <AdminCard className="space-y-4">
          <h2 className="font-semibold">Featured media</h2>

          <div className="flex items-center gap-4 text-sm">
            {(['image', 'video', 'gif'] as const).map((opt) => (
              <label key={opt} className="flex items-center gap-1.5">
                <input type="radio" value={opt} {...register('featuredMediaType')} className="h-3.5 w-3.5" />
                {opt === 'image' ? 'Image' : opt === 'video' ? 'Video' : 'GIF'}
              </label>
            ))}
          </div>

          <div className="flex items-start gap-4">
            {watch('featuredMediaType') === 'video' ? (
              <ImageUploadField
                accept="image+video"
                mediaType="video"
                value={watch('featuredVideoSrc')}
                onChange={(src) => setValue('featuredVideoSrc', src, { shouldValidate: true })}
                category="blog"
              />
            ) : (
              <ImageUploadField
                accept="image+video"
                mediaType={watch('featuredMediaType') === 'gif' ? 'gif' : 'image'}
                value={watch('featuredImageSrc')}
                onChange={(src) => setValue('featuredImageSrc', src, { shouldValidate: true })}
                category="blog"
              />
            )}
            <div className="flex-1">
              <FormRow label="Alt text" error={errors.featuredImageAlt?.message}>
                <input className="form-input" {...register('featuredImageAlt')} />
              </FormRow>
            </div>
          </div>
          {watch('featuredMediaType') === 'video' && (
            <FormRow label="Poster image (optional)" hint="Shown while the video loads.">
              <ImageUploadField
                value={watch('featuredImageSrc')}
                onChange={(src) => setValue('featuredImageSrc', src, { shouldValidate: true })}
                category="blog"
              />
            </FormRow>
          )}
          {errors.featuredImageSrc && (
            <p className="text-xs text-[var(--color-coral-deep)]">{errors.featuredImageSrc.message}</p>
          )}
        </AdminCard>

        <AdminCard className="space-y-4">
          <h2 className="font-semibold">Content</h2>
          <Controller
            control={control}
            name="contentHtml"
            render={({ field }) => (
              <RichTextEditor
                value={field.value ?? ''}
                onChange={field.onChange}
                ariaLabel="Blog content"
                hint="Use Heading 2 for main sections and Heading 3 for sub-sections. Paste from Word or Google Docs is cleaned automatically."
              />
            )}
          />
          {errors.contentHtml && (
            <p className="text-xs text-[var(--color-coral-deep)]">{errors.contentHtml.message}</p>
          )}
        </AdminCard>

        <AdminCard className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <FormRow label="Category" error={errors.category?.message}>
              <input className="form-input" {...register('category')} />
            </FormRow>
            <FormRow label="Tags (comma separated)">
              <input className="form-input" {...register('tags')} />
            </FormRow>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <FormRow label="Author" error={errors.author?.message}>
              <input className="form-input" {...register('author')} />
            </FormRow>
            <FormRow label="Status" hint="Drafts are only visible here. Published posts go live straight away.">
              <select className="form-input" {...register('status')}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </FormRow>
          </div>
        </AdminCard>

        <AdminCard className="space-y-4">
          <h2 className="font-semibold">SEO</h2>
          <FormRow label="SEO meta title" hint={`${(watch('seoTitle') ?? '').length}/70 — used as the browser/search title`} error={errors.seoTitle?.message}>
            <input className="form-input" {...register('seoTitle')} />
          </FormRow>
          <FormRow label="SEO meta description" hint={`${(watch('seoDescription') ?? '').length}/160 — used as the search/social description`} error={errors.seoDescription?.message}>
            <textarea rows={2} className="form-input" {...register('seoDescription')} />
          </FormRow>
        </AdminCard>

        <div className="flex gap-3">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : isNew ? 'Create post' : 'Save changes'}
          </Button>
          <Button type="button" variant="secondary" onClick={() => navigate('/admin/blogs')}>
            Cancel
          </Button>
          {existing?.status === 'published' && (
            <a href={`/blog/${existing.slug}`} target="_blank" rel="noopener noreferrer" className="self-center text-sm font-medium text-[var(--color-coral-deep)] underline">
              View live post
            </a>
          )}
        </div>
      </form>
    </div>
  );
}
