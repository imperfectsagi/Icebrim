import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { AdminPageHeader, AdminCard, FormRow } from '../components/AdminUi';
import { Button } from '@/components/ui/Button';
import { ImageUploadField } from '../components/ImageUploadField';
import { useAdminProducts, useCreateProduct, useUpdateProduct } from '../hooks/useAdminProducts';
import { useEffect } from 'react';
import { slugify } from '@/lib/slugify';

const specSchema = z.object({ label: z.string().min(1), value: z.string().min(1) });
const imageSchema = z.object({ id: z.string(), src: z.string().min(1, 'Upload an image'), alt: z.string().min(1, 'Add alt text') });

const productSchema = z.object({
  name: z.string().min(2, 'Product name is required'),
  slug: z.string().min(2, 'URL slug is required').regex(/^[a-z0-9-]+$/, 'Use lowercase letters, numbers, and hyphens only'),
  category: z.string().min(1, 'Category is required'),
  sku: z.string().min(1, 'SKU is required'),
  price: z.number({ error: 'Enter a price' }).positive('Price must be greater than 0'),
  offerPrice: z.number().positive().optional().or(z.literal(undefined)),
  stock: z.number({ error: 'Enter stock quantity' }).int().min(0, 'Stock cannot be negative'),
  shortDescription: z.string().min(10, 'Add a short description').max(300),
  description: z.string().min(20, 'Add a full description'),
  images: z.array(imageSchema).min(1, 'Add at least one image'),
  specs: z.array(specSchema),
  seoTitle: z.string().min(3, 'SEO title is required').max(70, 'Keep under 70 characters'),
  seoDescription: z.string().min(10, 'SEO description is required').max(160, 'Keep under 160 characters'),
  published: z.boolean(),
});

type ProductFormValues = z.infer<typeof productSchema>;

export function AdminProductFormPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const { data: products } = useAdminProducts();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();

  const existing = !isNew ? products?.find((p) => p.id === id) : undefined;

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      currency: undefined,
      images: [],
      specs: [],
      published: true,
    } as unknown as ProductFormValues,
  });

  useEffect(() => {
    if (existing) {
      reset({
        name: existing.name,
        slug: existing.slug,
        category: existing.category,
        sku: existing.sku,
        price: existing.price,
        offerPrice: existing.offerPrice,
        stock: existing.stock,
        shortDescription: existing.shortDescription,
        description: existing.description,
        images: existing.images,
        specs: existing.specs,
        seoTitle: existing.seo.title,
        seoDescription: existing.seo.description,
        published: existing.published,
      });
    }
  }, [existing, reset]);

  const imagesArray = useFieldArray({ control, name: 'images' });
  const specsArray = useFieldArray({ control, name: 'specs' });
  const nameValue = watch('name');

  const onSubmit = async (values: ProductFormValues) => {
    const payload = {
      name: values.name,
      slug: values.slug,
      category: values.category,
      sku: values.sku,
      price: values.price,
      offerPrice: values.offerPrice,
      currency: 'GBP',
      stock: values.stock,
      shortDescription: values.shortDescription,
      description: values.description,
      images: values.images,
      specs: values.specs,
      seo: { title: values.seoTitle, description: values.seoDescription },
      published: values.published,
      ratingAverage: existing?.ratingAverage ?? 0,
      ratingCount: existing?.ratingCount ?? 0,
    };

    if (isNew) {
      await createProduct.mutateAsync(payload);
    } else if (id) {
      await updateProduct.mutateAsync({ id, ...payload });
    }
    navigate('/admin/products');
  };

  return (
    <div>
      <AdminPageHeader title={isNew ? 'Add Product' : 'Edit Product'} />

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6 max-w-3xl">
        <AdminCard className="space-y-4">
          <h2 className="font-semibold">Basic details</h2>
          <FormRow label="Product name" error={errors.name?.message}>
            <input
              className="form-input"
              {...register('name')}
              onBlur={(e) => {
                register('name').onBlur(e);
                if (isNew && !watch('slug')) setValue('slug', slugify(e.target.value));
              }}
            />
          </FormRow>
          <FormRow label="URL slug" hint={`icebrim.com/products/${watch('slug') || '...'}`} error={errors.slug?.message}>
            <input className="form-input" {...register('slug')} />
          </FormRow>
          <div className="grid sm:grid-cols-2 gap-4">
            <FormRow label="Category" error={errors.category?.message}>
              <input className="form-input" {...register('category')} />
            </FormRow>
            <FormRow label="SKU" error={errors.sku?.message}>
              <input className="form-input" {...register('sku')} />
            </FormRow>
          </div>
        </AdminCard>

        <AdminCard className="space-y-4">
          <h2 className="font-semibold">Pricing &amp; stock</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <FormRow label="Price (£)" error={errors.price?.message}>
              <input type="number" step="0.01" className="form-input" {...register('price', { valueAsNumber: true })} />
            </FormRow>
            <FormRow label="Offer price (£, optional)" error={errors.offerPrice?.message}>
              <input
                type="number"
                step="0.01"
                className="form-input"
                {...register('offerPrice', { valueAsNumber: true, setValueAs: (v) => (v === '' || Number.isNaN(v) ? undefined : v) })}
              />
            </FormRow>
            <FormRow label="Stock" error={errors.stock?.message}>
              <input type="number" className="form-input" {...register('stock', { valueAsNumber: true })} />
            </FormRow>
          </div>
        </AdminCard>

        <AdminCard className="space-y-4">
          <h2 className="font-semibold">Images</h2>
          {imagesArray.fields.map((field, i) => (
            <div key={field.id} className="flex items-start gap-3">
              <ImageUploadField
                value={watch(`images.${i}.src`)}
                onChange={(src) => setValue(`images.${i}.src`, src, { shouldValidate: true })}
              />
              <div className="flex-1">
                <FormRow label="Alt text" error={errors.images?.[i]?.alt?.message}>
                  <input className="form-input" {...register(`images.${i}.alt`)} />
                </FormRow>
              </div>
              <button
                type="button"
                onClick={() => imagesArray.remove(i)}
                className="mt-7 p-2 rounded-lg hover:bg-[var(--color-coral-tint)] text-[var(--color-coral-deep)]"
                aria-label="Remove image"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          {errors.images && !Array.isArray(errors.images) && (
            <p className="text-xs text-[var(--color-coral-deep)]">{errors.images.message}</p>
          )}
          <button
            type="button"
            onClick={() => imagesArray.append({ id: crypto.randomUUID(), src: '', alt: '' })}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-coral-deep)]"
          >
            <Plus size={15} /> Add image
          </button>
        </AdminCard>

        <AdminCard className="space-y-4">
          <h2 className="font-semibold">Description</h2>
          <FormRow label="Short description" error={errors.shortDescription?.message}>
            <textarea rows={2} className="form-input" {...register('shortDescription')} />
          </FormRow>
          <FormRow label="Full description" error={errors.description?.message}>
            <textarea rows={6} className="form-input" {...register('description')} />
          </FormRow>
        </AdminCard>

        <AdminCard className="space-y-4">
          <h2 className="font-semibold">Specifications</h2>
          {specsArray.fields.map((field, i) => (
            <div key={field.id} className="flex items-center gap-3">
              <input className="form-input" placeholder="Label" {...register(`specs.${i}.label`)} />
              <input className="form-input" placeholder="Value" {...register(`specs.${i}.value`)} />
              <button
                type="button"
                onClick={() => specsArray.remove(i)}
                className="p-2 rounded-lg hover:bg-[var(--color-coral-tint)] text-[var(--color-coral-deep)]"
                aria-label="Remove spec"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => specsArray.append({ label: '', value: '' })}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-coral-deep)]"
          >
            <Plus size={15} /> Add specification
          </button>
        </AdminCard>

        <AdminCard className="space-y-4">
          <h2 className="font-semibold">SEO</h2>
          <FormRow label="SEO meta title" hint={`${watch('seoTitle')?.length ?? 0}/70`} error={errors.seoTitle?.message}>
            <input className="form-input" {...register('seoTitle')} placeholder={nameValue ? `${nameValue} | Icebrim` : ''} />
          </FormRow>
          <FormRow label="SEO meta description" hint={`${watch('seoDescription')?.length ?? 0}/160`} error={errors.seoDescription?.message}>
            <textarea rows={2} className="form-input" {...register('seoDescription')} />
          </FormRow>
        </AdminCard>

        <AdminCard>
          <label className="flex items-center gap-2.5 text-sm font-medium">
            <input type="checkbox" className="h-4 w-4" {...register('published')} />
            Published (visible on the live site)
          </label>
        </AdminCard>

        <div className="flex gap-3">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : isNew ? 'Create product' : 'Save changes'}
          </Button>
          <Button type="button" variant="secondary" onClick={() => navigate('/admin/products')}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
