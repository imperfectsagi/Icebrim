import type { ReactNode } from 'react';
import { Container, Eyebrow } from '@/components/ui/primitives';
import { SeoHead } from '@/components/common/SeoHead';

export function LegalPageLayout({
  title,
  updatedDate,
  canonicalPath,
  children,
}: {
  title: string;
  updatedDate: string;
  canonicalPath: string;
  children: ReactNode;
}) {
  return (
    <>
      <SeoHead
        seo={{
          title: `${title} | Icebrim`,
          description: `${title} for Icebrim.`,
          canonicalPath,
        }}
      />
      <section className="py-16 md:py-20">
        <Container className="max-w-2xl">
          <Eyebrow>Legal</Eyebrow>
          <h1 className="font-display text-3xl md:text-4xl font-medium mb-2 text-balance">
            {title}
          </h1>
          <p className="text-sm text-[var(--color-ink-soft)] mb-10">Last updated: {updatedDate}</p>
          <div className="prose-content">{children}</div>
        </Container>
      </section>
    </>
  );
}
