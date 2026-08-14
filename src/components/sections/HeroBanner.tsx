import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/primitives';
import { Check } from 'lucide-react';
import type { HeroBannerContent } from '@/types/cms';

export function HeroBanner({ content }: { content: HeroBannerContent }) {
  if (!content.visible) return null;

  const isVideo = content.mediaType === 'video' && content.videoSrc;

  return (
    <section className="relative isolate overflow-hidden bg-[var(--color-surface)]">
      {/* Full-bleed banner media: image (default) or a short looping video/gif */}
      <div className="absolute inset-0">
        {isVideo ? (
          <video
            src={content.videoSrc}
            poster={content.image.src || undefined}
            className="h-full w-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            // Banners are decorative background media, not primary content --
            // preload just the metadata rather than the whole file so it
            // doesn't compete with the page's actual first-load bandwidth.
            preload="metadata"
          />
        ) : content.image.mobileSrc ? (
          // <picture> with a breakpoint-matched <source> so mobile
          // downloads a genuinely different, mobile-composed image
          // rather than the desktop image scaled/cropped by CSS --
          // object-cover alone can only crop what's already downloaded,
          // it can't recompose where the subject/negative-space sits.
          // The breakpoint matches Tailwind's default `sm` (640px, see
          // tailwind config) so this stays in sync with the rest of the
          // site's responsive system rather than introducing a new one.
          <picture>
            <source media="(max-width: 639px)" srcSet={content.image.mobileSrc} />
            <img
              src={content.image.src}
              alt=""
              role="presentation"
              className="h-full w-full object-cover"
              loading="eager"
              fetchPriority="high"
            />
          </picture>
        ) : (
          <img
            src={content.image.src}
            alt=""
            role="presentation"
            className="h-full w-full object-cover"
            loading="eager"
            fetchPriority="high"
          />
        )}
        {/* Frost gradient: signature element — mirrors the product's own
            frozen-to-clear function. Direction differs by breakpoint: on
            mobile there isn't enough horizontal room for a left-to-right
            wash to both show the image AND keep text readable (the same
            gradient that works at desktop width would either hide the
            image almost entirely or leave the text on a washed-out
            background) -- so mobile gets a top-to-bottom wash instead,
            keeping the image visible above and text on a solid readable
            background below, and the left-to-right composition returns
            at sm: and up where there's enough width for it to work as
            designed. */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-white/70 to-white sm:bg-gradient-to-r sm:from-white sm:via-white/80 sm:to-white/10" />
        <div className="absolute inset-0 bg-gradient-to-t from-white/90 via-transparent to-transparent" />
        <div className="frost-overlay absolute inset-0" aria-hidden="true" />
      </div>

      <Container className="relative pt-[45vw] pb-16 sm:py-24 md:py-32 lg:py-40">
        <div className="max-w-xl">
          <p
            className="text-sm font-semibold tracking-[0.08em] uppercase mb-4"
            style={{ color: content.textColor || 'var(--color-coral-deep)' }}
          >
            {content.eyebrow}
          </p>
          <h1
            className="font-display text-3xl sm:text-5xl lg:text-6xl font-medium leading-[1.1] sm:leading-[1.05] text-balance"
            style={{ color: content.textColor || 'var(--color-ink)' }}
          >
            {content.heading}
          </h1>
          <p
            className="mt-4 sm:mt-6 text-base sm:text-lg max-w-md"
            style={{ color: content.textColor || 'var(--color-ink-soft)' }}
          >
            {content.description}
          </p>

          <div className="mt-7 sm:mt-9 flex flex-wrap gap-3">
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
