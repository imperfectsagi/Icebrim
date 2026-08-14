import { Link } from 'react-router-dom';
import { usePromoBanner } from '@/hooks/useContent';

/**
 * Site-wide ON/OFF promo announcement strip. See AdminPromoBannerPage.tsx
 * for the admin editor and workers/src/routes/admin-content.ts
 * (site_content key "promo_banner") for storage. Renders nothing when
 * disabled or when there's no text to show.
 */
export function PromoBanner() {
  const { data } = usePromoBanner();

  if (!data?.enabled || !data.text) return null;

  const href =
    data.linkType === 'product' && data.linkSlug
      ? `/products/${data.linkSlug}`
      : data.linkType === 'page' && data.linkSlug
        ? `/pages/${data.linkSlug}`
        : null;

  const content = (
    <p className="text-center text-sm font-medium py-2.5 px-4">
      {data.text}
    </p>
  );

  return (
    <div className="bg-[var(--color-coral)] text-white">
      {href ? (
        <Link to={href} className="block hover:underline underline-offset-2">
          {content}
        </Link>
      ) : (
        content
      )}
    </div>
  );
}
