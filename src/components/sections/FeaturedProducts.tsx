import { Container, SectionHeading } from '@/components/ui/primitives';
import { ProductCard } from '@/components/common/ProductCard';
import { useProducts } from '@/hooks/useContent';
import type { FeaturedProductsContent } from '@/types/cms';

export function FeaturedProducts({ content }: { content: FeaturedProductsContent }) {
  const { data: allProducts } = useProducts();

  if (!content.visible) return null;

  const featured = allProducts ?? [];
  if (featured.length === 0) return null;

  return (
    <section className="py-20 md:py-28">
      <Container>
        <SectionHeading eyebrow={content.eyebrow} heading={content.heading} align="center" className="mb-14" />
        <div className="grid sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {featured.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </Container>
    </section>
  );
}
