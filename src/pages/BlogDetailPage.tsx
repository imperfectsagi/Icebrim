import { useParams, Navigate, Link } from 'react-router-dom';
import { Container, Badge } from '@/components/ui/primitives';
import { RichText } from '@/components/common/RichText';
import { SeoHead } from '@/components/common/SeoHead';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { useBlogPost } from '@/hooks/useContent';
import { formatDate } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';

export default function BlogDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: post, isLoading, isFetched } = useBlogPost(slug);

  if (isLoading) return <PageSkeleton />;
  if (isFetched && !post) return <Navigate to="/blog" replace />;
  if (!post) return null;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt,
    image: post.featuredImage.src,
    author: { '@type': 'Organization', name: post.author },
    datePublished: post.publishedAt,
  };

  return (
    <>
      <SeoHead seo={{ ...post.seo, canonicalPath: `/blog/${post.slug}` }} jsonLd={jsonLd} />

      <article className="py-10 md:py-14">
        <Container className="max-w-3xl">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-[var(--color-ink-soft)] mb-8">
            <Link to="/blog" className="hover:text-[var(--color-coral-deep)]">
              Blog
            </Link>
            <ChevronRight size={14} aria-hidden="true" />
            <span className="text-[var(--color-ink)] line-clamp-1">{post.title}</span>
          </nav>

          <Badge tone="ice" className="mb-4">
            {post.category}
          </Badge>
          <h1 className="font-display text-3xl md:text-5xl font-medium mb-4 text-balance">
            {post.title}
          </h1>
          <p className="text-sm text-[var(--color-ink-soft)] mb-10">
            {post.author} · {formatDate(post.publishedAt)}
          </p>

          <div className="rounded-[var(--radius-card)] overflow-hidden aspect-[16/9] mb-10">
            {post.featuredMediaType === 'video' && post.featuredVideoSrc ? (
              <video
                src={post.featuredVideoSrc}
                poster={post.featuredImage.src || undefined}
                className="h-full w-full object-cover"
                controls
                muted
                playsInline
                preload="metadata"
              />
            ) : (
              <img
                src={post.featuredImage.src}
                alt={post.featuredImage.alt}
                // Featured image is the largest above-the-fold element on
                // this page (likely the LCP element) -- load it eagerly,
                // don't lazy-load it.
                loading="eager"
                fetchPriority="high"
                className="h-full w-full object-cover"
              />
            )}
          </div>

          <RichText html={post.contentHtml} className="prose-content" />

          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-10 pt-8 border-t border-[var(--color-line)]">
              {post.tags.map((tag) => (
                <Badge key={tag} tone="coral">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </Container>
      </article>
    </>
  );
}
