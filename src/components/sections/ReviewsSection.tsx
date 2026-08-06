import { Container, SectionHeading } from '@/components/ui/primitives';
import { StarRating } from '@/components/ui/StarRating';
import { ReviewCard } from '@/components/common/ReviewCard';
import { Button } from '@/components/ui/Button';
import { useApprovedReviews } from '@/hooks/useContent';
import type { ReviewsSectionContent } from '@/types/cms';

export function ReviewsSection({ content }: { content: ReviewsSectionContent }) {
  const { data: reviews } = useApprovedReviews();

  if (!content.visible) return null;

  const shown = (reviews ?? []).slice(0, content.maxDisplayed);
  if (shown.length === 0) return null;

  const avg = shown.reduce((sum, r) => sum + r.rating, 0) / shown.length;

  return (
    <section className="py-20 md:py-28">
      <Container>
        <div className="flex flex-col items-center text-center mb-14">
          <SectionHeading eyebrow={content.eyebrow} heading={content.heading} align="center" />
          <StarRating value={avg} count={shown.length} className="mt-4" size={18} />
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {shown.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
        <div className="flex justify-center mt-10">
          <Button href="/products" variant="secondary">
            Read all reviews
          </Button>
        </div>
      </Container>
    </section>
  );
}
