import DOMPurify from 'dompurify';

/**
 * Renders CMS-authored rich text (from the Blog CMS rich text editor).
 *
 * Content is sanitized with DOMPurify before insertion. This matters even
 * though the content comes from the admin's own rich text editor and not
 * directly from public visitors: it defends against stored XSS if an
 * admin account is ever compromised, and against any future integration
 * (import tools, migrations) that pipes untrusted HTML into blog content.
 */
export function RichText({ html, className }: { html: string; className?: string }) {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 's', 'a', 'ul', 'ol', 'li',
      'h2', 'h3', 'h4', 'blockquote', 'img', 'figure', 'figcaption', 'code', 'pre',
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'target', 'rel', 'loading'],
  });

  // Blog body images come from the CMS rich text editor and can be
  // numerous (long posts, photo-heavy articles). Force lazy loading on
  // every one of them here so editors don't have to remember to set it
  // per-image, and so a post with many images doesn't block the page.
  const lazyLoaded = clean.replace(/<img(?![^>]*\bloading=)/g, '<img loading="lazy"');

  return (
    <div
      className={className}
      // eslint-disable-next-line react/no-danger -- sanitized above with DOMPurify
      dangerouslySetInnerHTML={{ __html: lazyLoaded }}
    />
  );
}
