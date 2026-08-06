import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/primitives';
import type { BlogPost } from '@/types/cms';

export function BlogCard({ post }: { post: BlogPost }) {
  return (
    <Link
      to={`/blog/${post.slug}`}
      className="group block rounded-[var(--radius-card)] overflow-hidden bg-white border border-[var(--color-line)] hover:shadow-[var(--shadow-lift)] transition-shadow duration-300"
    >
      <div className="aspect-[16/10] overflow-hidden bg-[var(--color-surface)]">
        <img
          src={post.featuredImage.src}
          alt={post.featuredImage.alt}
          loading="lazy"
          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
      </div>
      <div className="p-5">
        <Badge tone="ice" className="mb-3">
          {post.category}
        </Badge>
        <h3 className="font-semibold text-lg mb-2 leading-snug">{post.title}</h3>
        <p className="text-sm text-[var(--color-ink-soft)] line-clamp-2">{post.excerpt}</p>
      </div>
    </Link>
  );
}
