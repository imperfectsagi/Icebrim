import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

export function StarRating({
  value,
  count,
  size = 16,
  className,
}: {
  value: number;
  count?: number;
  size?: number;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-1.5', className)} role="img" aria-label={`Rated ${value} out of 5 stars`}>
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => {
          const filled = i + 1 <= Math.round(value);
          return (
            <Star
              key={i}
              size={size}
              className={filled ? 'fill-[var(--color-coral)] text-[var(--color-coral)]' : 'text-[var(--color-line)]'}
              aria-hidden="true"
            />
          );
        })}
      </div>
      {typeof count === 'number' && (
        <span className="text-sm text-[var(--color-ink-soft)]">
          {value.toFixed(1)} ({count} review{count === 1 ? '' : 's'})
        </span>
      )}
    </div>
  );
}
