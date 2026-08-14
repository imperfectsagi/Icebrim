import { Link } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { formatPrice, percentOff } from '@/lib/utils';
import { StarRating } from '@/components/ui/StarRating';
import { Badge } from '@/components/ui/primitives';
import { useCart } from '@/features/cart/CartContext';
import type { Product } from '@/types/cms';

export function ProductCard({ product }: { product: Product }) {
  const hasOffer = typeof product.offerPrice === 'number' && product.offerPrice < product.price;
  const { addItem } = useCart();

  const handleQuickAdd = (e: React.MouseEvent) => {
    // Stop the click from bubbling to the surrounding <Link>, or "quick add"
    // would also navigate to the product page -- not what a quick-add
    // button implies.
    e.preventDefault();
    e.stopPropagation();
    addItem({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      image: product.images[0]?.src ?? '',
      unitPrice: hasOffer ? product.offerPrice! : product.price,
      currency: product.currency,
      availableStock: product.stock,
    });
  };

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
        {product.stock > 0 && (
          <button
            type="button"
            onClick={handleQuickAdd}
            className="absolute bottom-3 right-3 h-10 w-10 rounded-full bg-white shadow-[var(--shadow-soft)] flex items-center justify-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity hover:bg-[var(--color-coral)] hover:text-white"
            aria-label={`Add ${product.name} to cart`}
          >
            <ShoppingBag size={16} aria-hidden="true" />
          </button>
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
