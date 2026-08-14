import { Container, SectionHeading } from '@/components/ui/primitives';
import type { HowItWorksContent } from '@/types/cms';

export function HowItWorks({ content }: { content: HowItWorksContent }) {
  if (!content.visible) return null;

  return (
    <section id="how-it-works" className="py-20 md:py-28">
      <Container>
        <SectionHeading eyebrow={content.eyebrow} heading={content.heading} align="center" className="mb-14" />
        <ol className="grid md:grid-cols-3 gap-8 md:gap-6">
          {content.steps.map((step, i) => (
            <li key={step.id} className="relative">
              <div className="flex items-center gap-3 mb-4">
                <span className="font-display text-2xl text-[var(--color-coral-deep)]">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="h-px flex-1 bg-[var(--color-line)]" aria-hidden="true" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
              <p className="text-[var(--color-ink-soft)]">{step.description}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
