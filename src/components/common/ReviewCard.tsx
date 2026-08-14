import { StarRating } from '@/components/ui/StarRating';
import { Card } from '@/components/ui/primitives';
import { formatDate } from '@/lib/utils';
import type { Review } from '@/types/cms';

export function ReviewCard({ review }: { review: Review }) {
  const mediaImages = review.mediaImages ?? [];
  return (
    <Card className="p-6">
      <StarRating value={review.rating} className="mb-4" />
      <h3 className="font-semibold mb-2">{review.title}</h3>
      <p className="text-sm text-[var(--color-ink-soft)] leading-relaxed mb-4">{review.body}</p>
      {review.mediaType && review.mediaType !== 'none' && review.mediaSrc && (
        <div className="mb-3 rounded-lg overflow-hidden max-w-xs">
          {review.mediaType === 'video' ? (
            <video src={review.mediaSrc} className="w-full h-auto" controls muted playsInline preload="metadata" />
          ) : (
            <img src={review.mediaSrc} alt={`Photo from ${review.authorName}'s review`} loading="lazy" className="w-full h-auto object-cover" />
          )}
        </div>
      )}
      {mediaImages.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {mediaImages.map((src, i) => (
            <img
              key={src}
              src={src}
              alt={`Photo ${i + 1} from ${review.authorName}'s review`}
              loading="lazy"
              className="h-20 w-20 rounded-lg object-cover"
            />
          ))}
        </div>
      )}
      <p className="text-xs text-[var(--color-ink-soft)]">
        {review.authorName}
        {review.location ? ` · ${review.location}` : ''} · {formatDate(review.createdAt)}
      </p>
    </Card>
  );
}
