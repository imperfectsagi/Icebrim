import { Container, SectionHeading } from '@/components/ui/primitives';
import { StarRating } from '@/components/ui/StarRating';
import { ReviewCard } from '@/components/common/ReviewCard';
import { MasonryGrid } from '@/components/common/MasonryGrid';
import { Button } from '@/components/ui/Button';
import { useApprovedReviews } from '@/hooks/useContent';
import type { ReviewsSectionContent } from '@/types/cms';

/**
 * Home page reviews preview. "Read all reviews" opens the dedicated
 * /reviews page (ReviewsPage.tsx), which has the same "Real customers /
 * Trusted across the UK" heading and rating followed by every review.
 */
export function ReviewsSection({ content }: { content: ReviewsSectionContent }) {
  const { data: reviews } = useApprovedReviews();

  if (!content.visible) return null;

  const all = reviews ?? [];
  const shown = all.slice(0, content.maxDisplayed);
  if (shown.length === 0) return null;

  // The rating summary reflects every approved review, not just the few
  // cards previewed on the homepage.
  const avg = all.reduce((sum, r) => sum + r.rating, 0) / all.length;

  return (
    <section className="py-20 md:py-28" id="reviews">
      <Container>
        <div className="flex flex-col items-center text-center mb-14">
          <SectionHeading eyebrow={content.eyebrow} heading={content.heading} align="center" />
          <StarRating value={avg} count={all.length} className="mt-4" size={18} />
        </div>

        <MasonryGrid>
          {shown.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </MasonryGrid>

        <div className="flex justify-center mt-10">
          <Button href="/reviews" variant="secondary">
            {`Read all reviews${all.length > shown.length ? ` (${all.length})` : ''}`}
          </Button>
        </div>
      </Container>
    </section>
  );
}
