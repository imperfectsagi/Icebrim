import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/primitives';
import { Check } from 'lucide-react';
import type { HeroBannerContent } from '@/types/cms';

export function HeroBanner({ content }: { content: HeroBannerContent }) {
  if (!content.visible) return null;

  return (
    <section className="relative isolate overflow-hidden bg-[var(--color-surface)]">
      {/* Full-bleed banner image */}
      <div className="absolute inset-0">
        <img
          src={content.image.src}
          alt=""
          role="presentation"
          className="h-full w-full object-cover"
          loading="eager"
          fetchPriority="high"
        />
        {/* Frost gradient: signature element — mirrors the product's own frozen-to-clear function */}
        <div className="absolute inset-0 bg-gradient-to-r from-white via-white/80 to-white/10" />
        <div className="absolute inset-0 bg-gradient-to-t from-white/90 via-transparent to-transparent" />
        <div className="frost-overlay absolute inset-0" aria-hidden="true" />
      </div>

      <Container className="relative py-24 md:py-32 lg:py-40">
        <div className="max-w-xl">
          <p className="text-sm font-semibold tracking-[0.08em] uppercase text-[var(--color-coral-deep)] mb-4">
            {content.eyebrow}
          </p>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-medium leading-[1.05] text-[var(--color-ink)] text-balance">
            {content.heading}
          </h1>
          <p className="mt-6 text-lg text-[var(--color-ink-soft)] max-w-md">
            {content.description}
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            <Button href={content.primaryCta.href} size="lg">
              {content.primaryCta.label}
            </Button>
            {content.secondaryCta && (
              <Button href={content.secondaryCta.href} variant="secondary" size="lg">
                {content.secondaryCta.label}
              </Button>
            )}
          </div>

          {content.trustBadges.length > 0 && (
            <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-2">
              {content.trustBadges.map((badge) => (
                <li key={badge} className="flex items-center gap-1.5 text-sm text-[var(--color-ink-soft)]">
                  <Check size={15} className="text-[var(--color-coral-deep)]" aria-hidden="true" />
                  {badge}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Container>

      <style>{`
        .frost-overlay {
          background-image:
            radial-gradient(circle at 15% 20%, rgba(207,232,234,0.35), transparent 40%),
            radial-gradient(circle at 85% 15%, rgba(207,232,234,0.25), transparent 35%);
          opacity: 1;
          animation: frost-thaw 2.4s ease-out forwards;
        }
        @keyframes frost-thaw {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .frost-overlay { animation: none; opacity: 0; }
        }
      `}</style>
    </section>
  );
}
