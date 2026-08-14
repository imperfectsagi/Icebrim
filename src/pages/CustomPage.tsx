import { useParams } from 'react-router-dom';
import { Container } from '@/components/ui/primitives';
import { SeoHead } from '@/components/common/SeoHead';
import { RichText } from '@/components/common/RichText';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { useCmsPage } from '@/hooks/useContent';
import NotFoundPage from '@/pages/NotFoundPage';

/**
 * Renders any admin-created page from Page Management (see
 * useAdminPages.ts / workers/src/routes/pages.ts) at /pages/:slug.
 * Unlike the fixed policy pages (Privacy/Cookie/Terms, each with its own
 * dedicated route + component), custom pages are open-ended, so a single
 * route resolves the slug at request time and 404s the same way an
 * unrecognized static route already does if nothing published matches.
 */
export default function CustomPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: page, isLoading, isError } = useCmsPage(slug);

  if (isLoading) return <PageSkeleton />;
  if (isError || !page) return <NotFoundPage />;

  return (
    <>
      <SeoHead
        seo={{
          title: page.seo.title || `${page.title} | Icebrim`,
          description: page.seo.description || page.title,
          canonicalPath: `/pages/${page.slug}`,
        }}
      />
      <section className="py-16 md:py-20">
        <Container className="max-w-2xl">
          <h1 className="font-display text-3xl md:text-4xl font-medium mb-8 text-balance">{page.title}</h1>
          <RichText html={page.contentHtml} className="prose-content" />
        </Container>
      </section>
    </>
  );
}
