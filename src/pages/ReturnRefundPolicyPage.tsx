import { LegalPageLayout } from '@/components/common/LegalPageLayout';
import { RichText } from '@/components/common/RichText';
import { usePolicyPage } from '@/hooks/useContent';

export default function ReturnRefundPolicyPage() {
  const { data, isLoading } = usePolicyPage('policy_refund');

  return (
    <LegalPageLayout
      title={data?.title ?? 'Return & Refund Policy'}
      description="How returns, exchanges, and refunds work for orders placed with Icebrim, including timelines and how to start a return."
      updatedDate={data?.updatedDateLabel ?? ''}
      canonicalPath="/return-refund-policy"
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
