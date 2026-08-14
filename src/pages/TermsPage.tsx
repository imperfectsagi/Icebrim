import { LegalPageLayout } from '@/components/common/LegalPageLayout';
import { RichText } from '@/components/common/RichText';
import { usePolicyPage } from '@/hooks/useContent';

export default function TermsPage() {
  const { data, isLoading } = usePolicyPage('policy_terms');

  return (
    <LegalPageLayout
      title={data?.title ?? 'Terms & Conditions'}
      description="The terms that govern purchases from Icebrim, including orders, payment, shipping, returns, and use of icebrim.com."
      updatedDate={data?.updatedDateLabel ?? ''}
      canonicalPath="/terms"
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
