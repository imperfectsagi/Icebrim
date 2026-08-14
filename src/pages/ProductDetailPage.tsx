import { useState } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { Container } from '@/components/ui/primitives';
import { Button } from '@/components/ui/Button';
import { StarRating } from '@/components/ui/StarRating';
import { ReviewCard } from '@/components/common/ReviewCard';
import { ReviewForm } from '@/components/common/ReviewForm';
import { SeoHead } from '@/components/common/SeoHead';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { useProduct, useApprovedReviews } from '@/hooks/useContent';
import { useCart } from '@/features/cart/CartContext';
import { formatPrice, percentOff, cn } from '@/lib/utils';
import { ChevronRight, Minus, Plus, Check, Film } from 'lucide-react';

export default function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: product, isLoading, isFetched } = useProduct(slug);
  const { data: reviews } = useApprovedReviews(slug);
  const [activeMedia, setActiveMedia] = useState<number | 'video'>(0);
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);
  const { addItem, openCart } = useCart();

  if (isLoading) return <PageSkeleton />;
  if (isFetched && !product) return <Navigate to="/products" replace />;
  if (!product) return null;

  const hasOffer = typeof product.offerPrice === 'number' && product.offerPrice < product.price;
  const productReviews = reviews ?? [];
  const hasVideo = !!product.videoUrl;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.shortDescription,
    sku: product.sku,
    offers: {
      '@type': 'Offer',
      price: hasOffer ? product.offerPrice : product.price,
      priceCurrency: product.currency,
      availability: product.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    },
    ...(product.ratingCount > 0 && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: product.ratingAverage,
        reviewCount: product.ratingCount,
      },
    }),
  };

  return (
    <>
      <SeoHead
        seo={{ ...product.seo, canonicalPath: `/products/${product.slug}` }}
        jsonLd={jsonLd}
      />

      <section className="py-10 md:py-14">
        <Container>
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-[var(--color-ink-soft)] mb-8">
            <Link to="/products" className="hover:text-[var(--color-coral-deep)]">
              Products
            </Link>
            <ChevronRight size={14} aria-hidden="true" />
            <span className="text-[var(--color-ink)]">{product.name}</span>
          </nav>

          <div className="grid md:grid-cols-2 gap-10 lg:gap-16">
            {/* Gallery */}
            <div>
              <div className="rounded-[var(--radius-card)] overflow-hidden aspect-square bg-[var(--color-surface)] mb-3">
                {activeMedia === 'video' && product.videoUrl ? (
                  <video
                    src={product.videoUrl}
                    className="h-full w-full object-cover"
                    controls
                    playsInline
                    preload="metadata"
                  />
                ) : (
                  <img
                    src={product.images[activeMedia as number]?.src}
                    alt={product.images[activeMedia as number]?.alt ?? product.name}
                    // Main product image is the primary visual on this page --
                    // load it eagerly with high priority rather than lazily,
                    // so it's not delayed the way genuinely offscreen images
                    // should be.
                    loading="eager"
                    fetchPriority="high"
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              {(product.images.length > 1 || hasVideo) && (
                <div className="flex gap-2">
                  {product.images.map((img, i) => (
                    <button
                      key={img.id}
                      onClick={() => setActiveMedia(i)}
                      className={cn(
                        'h-16 w-16 rounded-lg overflow-hidden border-2',
                        activeMedia === i ? 'border-[var(--color-coral)]' : 'border-transparent',
                      )}
                      aria-label={`Show image ${i + 1}`}
                    >
                      <img src={img.src} alt="" loading="lazy" className="h-full w-full object-cover" />
                    </button>
                  ))}
                  {hasVideo && (
                    <button
                      onClick={() => setActiveMedia('video')}
                      className={cn(
                        'relative h-16 w-16 rounded-lg overflow-hidden border-2 bg-[var(--color-ink)] flex items-center justify-center',
                        activeMedia === 'video' ? 'border-[var(--color-coral)]' : 'border-transparent',
                      )}
                      aria-label="Show product video"
                    >
                      <Film size={20} className="text-white" aria-hidden="true" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Info */}
            <div>
              <h1 className="font-display text-3xl md:text-4xl font-medium mb-3 text-balance">
                {product.name}
              </h1>

              {product.ratingCount > 0 && (
                <StarRating value={product.ratingAverage} count={product.ratingCount} className="mb-4" />
              )}

              <div className="flex items-baseline gap-3 mb-6">
                <span className="text-2xl font-semibold">
                  {formatPrice(hasOffer ? product.offerPrice! : product.price, product.currency)}
                </span>
                {hasOffer && (
                  <>
                    <span className="text-[var(--color-ink-soft)] line-through">
                      {formatPrice(product.price, product.currency)}
                    </span>
                    <span className="text-sm font-semibold text-[var(--color-coral-deep)]">
                      Save {percentOff(product.price, product.offerPrice!)}%
                    </span>
                  </>
                )}
              </div>

              <p className="text-[var(--color-ink-soft)] leading-relaxed mb-8">
                {product.shortDescription}
              </p>

              {product.stock > 0 && (
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-sm font-medium text-[var(--color-ink-soft)]">Quantity</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      disabled={quantity <= 1}
                      className="h-9 w-9 rounded-full border border-[var(--color-line)] flex items-center justify-center disabled:opacity-40"
                      aria-label="Decrease quantity"
                    >
                      <Minus size={14} aria-hidden="true" />
                    </button>
                    <span className="text-sm font-medium w-6 text-center" aria-live="polite">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))}
                      disabled={quantity >= product.stock}
                      className="h-9 w-9 rounded-full border border-[var(--color-line)] flex items-center justify-center disabled:opacity-40"
                      aria-label="Increase quantity"
                    >
                      <Plus size={14} aria-hidden="true" />
                    </button>
                  </div>
                  {product.stock <= 10 && (
                    <span className="text-xs text-[var(--color-coral-deep)] font-medium">
                      Only {product.stock} left
                    </span>
                  )}
                </div>
              )}

              <Button
                size="lg"
                className="w-full sm:w-auto"
                disabled={product.stock === 0}
                onClick={() => {
                  addItem(
                    {
                      productId: product.id,
                      slug: product.slug,
                      name: product.name,
                      image: product.images[0]?.src ?? '',
                      unitPrice: hasOffer ? product.offerPrice! : product.price,
                      currency: product.currency,
                      availableStock: product.stock,
                    },
                    quantity,
                  );
                  setJustAdded(true);
                  window.setTimeout(() => setJustAdded(false), 2000);
                  window.setTimeout(() => openCart(), 300);
                }}
              >
                {product.stock === 0 ? (
                  'Out of stock'
                ) : justAdded ? (
                  <>
                    <Check size={18} aria-hidden="true" /> Added
                  </>
                ) : (
                  'Add to Cart'
                )}
              </Button>

              {product.specs.length > 0 && (
                <dl className="mt-10 divide-y divide-[var(--color-line)] border-t border-[var(--color-line)]">
                  {product.specs.map((spec) => (
                    <div key={spec.label} className="flex justify-between py-3 text-sm">
                      <dt className="text-[var(--color-ink-soft)]">{spec.label}</dt>
                      <dd className="font-medium text-right">{spec.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </div>

          {/* Full description */}
          <div className="mt-16 max-w-3xl">
            <h2 className="text-2xl font-medium mb-4">About this product</h2>
            <p className="text-[var(--color-ink-soft)] leading-relaxed">{product.description}</p>
          </div>

          {/* Reviews */}
          <div className="mt-20 max-w-4xl">
            <h2 className="text-2xl font-medium mb-8">Customer Reviews</h2>
            {productReviews.length > 0 ? (
              <div className="grid md:grid-cols-2 gap-5 mb-12">
                {productReviews.map((review) => (
                  <ReviewCard key={review.id} review={review} />
                ))}
              </div>
            ) : (
              <p className="text-[var(--color-ink-soft)] mb-12">Be the first to review this product.</p>
            )}

            <h3 className="text-lg font-semibold mb-5">Write a review</h3>
            <ReviewForm productSlug={product.slug} />
          </div>
        </Container>
      </section>
    </>
  );
}
