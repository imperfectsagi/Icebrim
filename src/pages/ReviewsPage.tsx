import { useState } from 'react';
import { Container, SectionHeading } from '@/components/ui/primitives';
import { StarRating } from '@/components/ui/StarRating';
import { Button } from '@/components/ui/Button';
import { ReviewCard } from '@/components/common/ReviewCard';
import { MasonryGrid } from '@/components/common/MasonryGrid';
import { SeoHead } from '@/components/common/SeoHead';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { useApprovedReviews, useHomeContent } from '@/hooks/useContent';

const PAGE_SIZE = 12;

/**
 * "Real customers -- Trusted across the UK": the full reviews page opened by
 * "Read all reviews" on the home page. The heading text comes from the same
 * admin-editable home page reviews section, so the two always match.
 */
export default function ReviewsPage() {
  const { data: home } = useHomeContent();
  const { data: reviews, isLoading } = useApprovedReviews();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  if (isLoading) return <PageSkeleton />;

  const all = reviews ?? [];
  const avg = all.length > 0 ? all.reduce((sum, r) => sum + r.rating, 0) / all.length : 0;
  const eyebrow = home?.reviews.eyebrow || 'Real customers';
  const heading = home?.reviews.heading || 'Trusted across the UK';

  return (
    <>
      <SeoHead
        seo={{
          title: 'Customer Reviews | Icebrim',
          description: 'Read what real customers across the UK say about the Icebrim cooling cap.',
          canonicalPath: '/reviews',
        }}
      />

      <section className="py-16 md:py-20">
        <Container>
          <div className="flex flex-col items-center text-center mb-14">
            <SectionHeading eyebrow={eyebrow} heading={heading} align="center" />
            {all.length > 0 && <StarRating value={avg} count={all.length} className="mt-4" size={18} />}
          </div>

          {all.length === 0 ? (
            <p className="text-center text-[var(--color-ink-soft)]">No reviews yet.</p>
          ) : (
            <>
              <MasonryGrid>
                {all.slice(0, visibleCount).map((review) => (
                  <ReviewCard key={review.id} review={review} />
                ))}
              </MasonryGrid>
              {visibleCount < all.length && (
                <div className="flex justify-center mt-10">
                  <Button type="button" variant="secondary" onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}>
                    Show more reviews
                  </Button>
                </div>
              )}
            </>
          )}
        </Container>
      </section>
    </>
  );
}
