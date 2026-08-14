import { LegalPageLayout } from '@/components/common/LegalPageLayout';
import { RichText } from '@/components/common/RichText';
import { usePolicyPage } from '@/hooks/useContent';

export default function CookiePolicyPage() {
  const { data, isLoading } = usePolicyPage('policy_cookie');

  return (
    <LegalPageLayout
      title={data?.title ?? 'Cookie Policy'}
      description="Which cookies Icebrim uses for site functionality, analytics, and your shopping cart, and how to manage your preferences."
      updatedDate={data?.updatedDateLabel ?? ''}
      canonicalPath="/cookie-policy"
    >
      {isLoading ? (
        <p className="text-sm text-[var(--color-ink-soft)]">Loading…</p>
      ) : data?.contentHtml ? (
        <RichText html={data.contentHtml} />
      ) : (
        <p className="text-sm text-[var(--color-ink-soft)]">
          This page hasn't been published yet. Please check back soon, or contact us via the
          Contact page with any questions.
        </p>
      )}
    </LegalPageLayout>
  );
}
