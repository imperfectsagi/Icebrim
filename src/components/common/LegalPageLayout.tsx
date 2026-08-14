import type { ReactNode } from 'react';
import { Container, Eyebrow } from '@/components/ui/primitives';
import { SeoHead } from '@/components/common/SeoHead';

export function LegalPageLayout({
  title,
  description,
  updatedDate,
  canonicalPath,
  children,
}: {
  title: string;
  /** SEO meta description. Falls back to a generic templated one if omitted, but a specific description per page is better for search snippets. */
  description?: string;
  updatedDate: string;
  canonicalPath: string;
  children: ReactNode;
}) {
  return (
    <>
      <SeoHead
        seo={{
          title: `${title} | Icebrim`,
          description: description ?? `${title} for Icebrim.`,
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
