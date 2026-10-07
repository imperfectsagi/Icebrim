import { useEffect, useRef, useState } from 'react';
import { Container, SectionHeading } from '@/components/ui/primitives';
import { StarRating } from '@/components/ui/StarRating';
import { ReviewCard } from '@/components/common/ReviewCard';
import { ReviewForm } from '@/components/common/ReviewForm';
import { Button } from '@/components/ui/Button';
import { useApprovedReviews, useProducts } from '@/hooks/useContent';
import type { ReviewsSectionContent } from '@/types/cms';

const PAGE_SIZE = 12;
const PANEL_ID = 'all-reviews';

export function ReviewsSection({ content }: { content: ReviewsSectionContent }) {
  const { data: reviews } = useApprovedReviews();
  const { data: products } = useProducts();
  const [showAll, setShowAll] = useState(() => typeof window !== 'undefined' && window.location.hash === `#${PANEL_ID}`);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [reviewProduct, setReviewProduct] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  // Opening via a #all-reviews link (or the button) scrolls the panel into view.
  useEffect(() => {
    if (showAll) panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [showAll]);

  if (!content.visible) return null;

  const all = reviews ?? [];
  const shown = all.slice(0, content.maxDisplayed);
  if (shown.length === 0) return null;

  // The rating summary reflects every approved review, not just the few
  // cards previewed on the homepage.
  const avg = all.reduce((sum, r) => sum + r.rating, 0) / all.length;

  const publishedProducts = (products ?? []).filter((p) => p.published);
  const selectedProduct = publishedProducts.find((p) => p.slug === reviewProduct) ?? publishedProducts[0];

  return (
    <section className="py-20 md:py-28" id="reviews">
      <Container>
        <div className="flex flex-col items-center text-center mb-14">
          <SectionHeading eyebrow={content.eyebrow} heading={content.heading} align="center" />
          <StarRating value={avg} count={all.length} className="mt-4" size={18} />
        </div>

        {/* Preview cards -- the full list opens below when "Read all reviews" is pressed. */}
        {!showAll && (
          <div className="grid md:grid-cols-3 gap-5">
            {shown.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>
        )}

        <div className="flex justify-center mt-10">
          <Button
            type="button"
            variant="secondary"
            aria-expanded={showAll}
            aria-controls={PANEL_ID}
            onClick={() => setShowAll((v) => !v)}
          >
            {showAll ? 'Hide all reviews' : `Read all reviews${all.length > shown.length ? ` (${all.length})` : ''}`}
          </Button>
        </div>

        <div id={PANEL_ID} ref={panelRef} hidden={!showAll} className="mt-12 scroll-mt-24">
          {showAll && (
            <>
              {/* Write a review comes FIRST so customers don't scroll past every review to reach it. */}
              {selectedProduct && (
                <div className="max-w-lg mx-auto mb-14 rounded-[var(--radius-card)] border border-[var(--color-line)] bg-white p-6">
                  <h3 className="text-lg font-semibold mb-5">Write a review</h3>
                  {publishedProducts.length > 1 && (
                    <div className="mb-5">
                      <label htmlFor="review-product" className="block text-sm font-medium mb-2">
                        Which product are you reviewing?
                      </label>
                      <select
                        id="review-product"
                        className="form-input"
                        value={selectedProduct.slug}
                        onChange={(e) => setReviewProduct(e.target.value)}
                      >
                        {publishedProducts.map((p) => (
                          <option key={p.slug} value={p.slug}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <ReviewForm key={selectedProduct.slug} productSlug={selectedProduct.slug} />
                </div>
              )}

              <h3 className="text-2xl font-medium mb-8 text-center">All customer reviews ({all.length})</h3>
              <div className="grid md:grid-cols-3 gap-5">
                {all.slice(0, visibleCount).map((review) => (
                  <ReviewCard key={review.id} review={review} />
                ))}
              </div>
              {visibleCount < all.length && (
                <div className="flex justify-center mt-10">
                  <Button type="button" variant="secondary" onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}>
                    Show more reviews
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </Container>
    </section>
  );
}
