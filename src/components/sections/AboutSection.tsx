import { Container, Eyebrow } from '@/components/ui/primitives';
import { Button } from '@/components/ui/Button';
import type { AboutSectionContent } from '@/types/cms';

export function AboutSection({ content }: { content: AboutSectionContent }) {
  if (!content.visible) return null;

  return (
    <section className="py-20 md:py-28 bg-[var(--color-surface)]">
      <Container className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">
        <div className="rounded-[var(--radius-card)] overflow-hidden aspect-[4/3] order-2 md:order-1">
          <img
            src={content.image.src}
            alt={content.image.alt}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        </div>
        <div className="order-1 md:order-2">
          <Eyebrow>{content.eyebrow}</Eyebrow>
          <h2 className="text-3xl md:text-4xl font-medium mb-5 text-balance">{content.heading}</h2>
          <p className="text-[var(--color-ink-soft)] mb-7 leading-relaxed">{content.body}</p>
          {content.cta && (
            <Button href={content.cta.href} variant="secondary">
              {content.cta.label}
            </Button>
          )}
        </div>
      </Container>
    </section>
  );
}
