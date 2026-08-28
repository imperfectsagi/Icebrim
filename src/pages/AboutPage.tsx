import { Container, Eyebrow } from '@/components/ui/primitives';
import { SeoHead } from '@/components/common/SeoHead';
import { ReadMoreSection } from '@/components/common/ReadMoreSection';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { useCompanySettings, useCmsPage } from '@/hooks/useContent';
import NotFoundPage from '@/pages/NotFoundPage';

/**
 * The About page's title/prose is admin-editable CMS content (Admin ->
 * Pages -> "About") rather than hardcoded here -- see migration
 * 0012_about_page_cms.sql, which seeded this page with the site's
 * original About copy so nothing changes for existing visitors until an
 * admin edits it. It's a "system" page (CmsPage.isSystem): always at
 * /about (src/router.tsx has a fixed route for it, same as before) and
 * can't be deleted, but its title, content, and publish status are all
 * editable the same way any other page is.
 */
export default function AboutPage() {
  const { data: company } = useCompanySettings();
  const { data: page, isLoading, isError } = useCmsPage('about');

  if (isLoading) return <PageSkeleton />;
  // The About page is a system/published page seeded by a migration, so
  // reaching this state means it was explicitly unpublished by an admin
  // (see the enable/disable behavior in Admin -> Pages) or the content
  // API is unreachable -- either way, the same 404 an admin-disabled
  // custom page shows is the correct behavior here too.
  if (isError || !page) return <NotFoundPage />;

  return (
    <>
      <SeoHead
        seo={{
          title: page.seo.title || `${page.title} | Icebrim`,
          description: page.seo.description || page.title,
          canonicalPath: '/about',
        }}
      />

      <section className="py-20 md:py-28">
        <Container className="max-w-3xl">
          <Eyebrow>About Icebrim</Eyebrow>
          <h1 className="font-display text-4xl md:text-5xl font-medium mb-8 text-balance">{page.title}</h1>
          <ReadMoreSection html={page.contentHtml} className="prose-content space-y-6 text-[var(--color-ink-soft)] text-lg leading-relaxed" />

          <div className="mt-14 rounded-[var(--radius-card)] bg-[var(--color-surface)] p-6 text-sm text-[var(--color-ink-soft)]">
            {company?.footerNote}
          </div>
        </Container>
      </section>
    </>
  );
}
