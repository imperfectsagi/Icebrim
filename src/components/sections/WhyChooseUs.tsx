import { Container, SectionHeading, Card } from '@/components/ui/primitives';
import { Snowflake } from 'lucide-react';
import type { WhyChooseUsContent } from '@/types/cms';

export function WhyChooseUs({ content }: { content: WhyChooseUsContent }) {
  if (!content.visible) return null;

  return (
    <section className="py-20 md:py-28 bg-[var(--color-surface)]">
      <Container>
        <SectionHeading eyebrow={content.eyebrow} heading={content.heading} align="center" className="mb-14" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {content.features.map((feature) => (
            <Card key={feature.id} className="p-6">
              <div className="h-10 w-10 rounded-full bg-[var(--color-ice)] flex items-center justify-center mb-4">
                <Snowflake size={18} className="text-[#1c4b4f]" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-[var(--color-ink-soft)]">{feature.description}</p>
            </Card>
          ))}
        </div>
      </Container>
    </section>
  );
}
