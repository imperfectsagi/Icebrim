import { Container, Eyebrow } from '@/components/ui/primitives';
import { SeoHead } from '@/components/common/SeoHead';
import { useCompanySettings } from '@/hooks/useContent';

export default function AboutPage() {
  const { data: company } = useCompanySettings();

  return (
    <>
      <SeoHead
        seo={{
          title: 'About Icebrim — Comfort Designed for Real UK Weeks',
          description:
            'Icebrim makes reusable cooling relief caps for migraines and menopause hot flushes. Learn why we started and how our caps are designed.',
          canonicalPath: '/about',
        }}
      />

      <section className="py-20 md:py-28">
        <Container className="max-w-3xl">
          <Eyebrow>About Icebrim</Eyebrow>
          <h1 className="font-display text-4xl md:text-5xl font-medium mb-8 text-balance">
            Comfort, designed around real UK weeks
          </h1>
          <div className="prose-content space-y-6 text-[var(--color-ink-soft)] text-lg leading-relaxed">
            <p>
              Icebrim started with a simple frustration: cooling caps that slipped, warmed up too
              fast, or felt painfully cold the moment they left the freezer. We set out to build
              one that actually fits, actually stays cold, and actually gets reached for on a bad
              day — not left in a drawer after the first try.
            </p>
            <p>
              Every design decision starts with the moment someone reaches for relief — usually
              mid-migraine, mid-hot-flush, at the worst possible time to fight with an ill-fitting
              product. That's why fit, cold retention, and comfort come before anything else.
            </p>
            <p>
              We're a small UK-based team, and {company?.name ?? 'Icebrim'} products are designed
              to be a genuine part of your self-care routine, not a novelty that gets used once
              and forgotten.
            </p>
          </div>

          <div className="mt-14 rounded-[var(--radius-card)] bg-[var(--color-surface)] p-6 text-sm text-[var(--color-ink-soft)]">
            {company?.footerNote}
          </div>
        </Container>
      </section>
    </>
  );
}
