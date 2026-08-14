import { LegalPageLayout } from '@/components/common/LegalPageLayout';
import { RichText } from '@/components/common/RichText';
import { usePolicyPage } from '@/hooks/useContent';

export default function PrivacyPolicyPage() {
  const { data, isLoading } = usePolicyPage('policy_privacy');

  return (
    <LegalPageLayout
      title={data?.title ?? 'Privacy Policy'}
      description="How Icebrim collects, uses, and protects your personal data when you shop with us, including checkout, order fulfilment, and marketing communications."
      updatedDate={data?.updatedDateLabel ?? ''}
      canonicalPath="/privacy-policy"
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
