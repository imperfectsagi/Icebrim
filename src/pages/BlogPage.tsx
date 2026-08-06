import { Container, Eyebrow } from '@/components/ui/primitives';
import { BlogCard } from '@/components/common/BlogCard';
import { SeoHead } from '@/components/common/SeoHead';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { useBlogPosts } from '@/hooks/useContent';

export default function BlogPage() {
  const { data: posts, isLoading } = useBlogPosts();

  if (isLoading) return <PageSkeleton />;

  return (
    <>
      <SeoHead
        seo={{
          title: 'Blog — Guides for Migraines, Menopause & Self-Care | Icebrim',
          description:
            'Practical guides on migraine relief, menopause hot flushes, and cold therapy, from the Icebrim team.',
          canonicalPath: '/blog',
        }}
      />

      <section className="py-16 md:py-20">
        <Container>
          <div className="max-w-xl mb-12">
            <Eyebrow>From the blog</Eyebrow>
            <h1 className="font-display text-4xl md:text-5xl font-medium text-balance">
              Guides for migraines, menopause, and self-care
            </h1>
          </div>

          {(posts ?? []).length === 0 ? (
            <p className="text-[var(--color-ink-soft)]">No posts published yet.</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {(posts ?? []).map((post) => (
                <BlogCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </Container>
      </section>
    </>
  );
}
