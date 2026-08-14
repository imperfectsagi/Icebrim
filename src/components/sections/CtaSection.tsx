import { Container } from '@/components/ui/primitives';
import { Button } from '@/components/ui/Button';
import type { CtaSectionContent } from '@/types/cms';

export function CtaSection({ content }: { content: CtaSectionContent }) {
  if (!content.visible) return null;

  return (
    <section className="relative isolate overflow-hidden py-24 md:py-32">
      <div className="absolute inset-0">
        <img src={content.image.src} alt="" role="presentation" loading="lazy" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-[var(--color-ink)]/55" />
      </div>
      <Container className="relative text-center">
        <h2 className="font-display text-3xl md:text-5xl font-medium text-white max-w-2xl mx-auto text-balance">
          {content.heading}
        </h2>
        <p className="mt-4 text-white/85 max-w-lg mx-auto text-lg">{content.description}</p>
        <div className="mt-9">
          <Button href={content.cta.href} size="lg">
            {content.cta.label}
          </Button>
        </div>
      </Container>
    </section>
  );
}
