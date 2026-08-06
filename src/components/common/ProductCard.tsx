import { Link } from 'react-router-dom';
import { formatPrice, percentOff } from '@/lib/utils';
import { StarRating } from '@/components/ui/StarRating';
import { Badge } from '@/components/ui/primitives';
import type { Product } from '@/types/cms';

export function ProductCard({ product }: { product: Product }) {
  const hasOffer = typeof product.offerPrice === 'number' && product.offerPrice < product.price;

  return (
    <Link
      to={`/products/${product.slug}`}
      className="group block rounded-[var(--radius-card)] bg-white border border-[var(--color-line)] overflow-hidden hover:shadow-[var(--shadow-lift)] transition-shadow duration-300"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-[var(--color-surface)]">
        <img
          src={product.images[0]?.src}
          alt={product.images[0]?.alt ?? product.name}
          loading="lazy"
          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        {hasOffer && (
          <Badge tone="coral" className="absolute top-3 left-3">
            Save {percentOff(product.price, product.offerPrice!)}%
          </Badge>
        )}
      </div>
      <div className="p-5">
        <h3 className="font-semibold text-lg mb-1">{product.name}</h3>
        <p className="text-sm text-[var(--color-ink-soft)] line-clamp-2 mb-3">
          {product.shortDescription}
        </p>
        {product.ratingCount > 0 && (
          <StarRating value={product.ratingAverage} count={product.ratingCount} className="mb-3" />
        )}
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-lg">
            {formatPrice(hasOffer ? product.offerPrice! : product.price, product.currency)}
          </span>
          {hasOffer && (
            <span className="text-sm text-[var(--color-ink-soft)] line-through">
              {formatPrice(product.price, product.currency)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
