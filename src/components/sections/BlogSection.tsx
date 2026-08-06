import { Container, SectionHeading } from '@/components/ui/primitives';
import { BlogCard } from '@/components/common/BlogCard';
import { Button } from '@/components/ui/Button';
import { useBlogPosts } from '@/hooks/useContent';
import type { BlogSectionContent } from '@/types/cms';

export function BlogSection({ content }: { content: BlogSectionContent }) {
  const { data: posts } = useBlogPosts();

  if (!content.visible) return null;

  const shown = (posts ?? []).slice(0, content.maxDisplayed);
  if (shown.length === 0) return null;

  return (
    <section className="py-20 md:py-28 bg-[var(--color-surface)]">
      <Container>
        <SectionHeading eyebrow={content.eyebrow} heading={content.heading} align="center" className="mb-14" />
        <div className="grid md:grid-cols-3 gap-6">
          {shown.map((post) => (
            <BlogCard key={post.id} post={post} />
          ))}
        </div>
        <div className="flex justify-center mt-10">
          <Button href="/blog" variant="secondary">
            Visit the blog
          </Button>
        </div>
      </Container>
    </section>
  );
}
