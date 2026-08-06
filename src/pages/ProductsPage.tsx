import { Container, Eyebrow } from '@/components/ui/primitives';
import { ProductCard } from '@/components/common/ProductCard';
import { SeoHead } from '@/components/common/SeoHead';
import { useProducts } from '@/hooks/useContent';
import { PageSkeleton } from '@/components/common/PageSkeleton';

export default function ProductsPage() {
  const { data: products, isLoading } = useProducts();

  if (isLoading) return <PageSkeleton />;

  const published = (products ?? []).filter((p) => p.published);

  return (
    <>
      <SeoHead
        seo={{
          title: 'Shop Cooling Relief Caps | Icebrim',
          description:
            'Shop reusable cooling relief caps for migraines, tension headaches, and menopause hot flushes. Free UK delivery over £30.',
          canonicalPath: '/products',
        }}
      />

      <section className="py-16 md:py-20">
        <Container>
          <div className="max-w-xl mb-12">
            <Eyebrow>Shop</Eyebrow>
            <h1 className="font-display text-4xl md:text-5xl font-medium text-balance">
              Find your relief kit
            </h1>
          </div>

          {published.length === 0 ? (
            <p className="text-[var(--color-ink-soft)]">No products are available right now.</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {published.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </Container>
      </section>
    </>
  );
}
