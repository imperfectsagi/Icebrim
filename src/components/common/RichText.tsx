import DOMPurify from 'dompurify';
import { normalizeContentHtml } from '@/lib/html-content';

// Links that open in a new tab must not hand the new page a reference back
// to this one (reverse tabnabbing). DOMPurify strips most attributes it
// doesn't allow; this hook runs on every sanitised <a> and adds the safe rel.
let hooksRegistered = false;
function registerHooks() {
  if (hooksRegistered) return;
  hooksRegistered = true;
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A' && node.getAttribute('target') === '_blank') {
      node.setAttribute('rel', 'noopener noreferrer');
    }
  });
}

export const RICH_TEXT_ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'u', 's', 'a', 'ul', 'ol', 'li',
  'h2', 'h3', 'h4', 'blockquote', 'img', 'figure', 'figcaption', 'code', 'pre',
  'hr', 'details', 'summary',
];
export const RICH_TEXT_ALLOWED_ATTR = ['href', 'src', 'alt', 'title', 'target', 'rel', 'loading', 'open'];

/** Sanitises and normalises admin-authored HTML for display (and for the editor's paste/source modes). */
export function sanitizeRichHtml(html: string): string {
  registerHooks();
  return DOMPurify.sanitize(normalizeContentHtml(html), {
    ALLOWED_TAGS: RICH_TEXT_ALLOWED_TAGS,
    ALLOWED_ATTR: RICH_TEXT_ALLOWED_ATTR,
  });
}

/**
 * Renders CMS-authored rich text (blog posts, pages, policies, product
 * descriptions).
 *
 * Content is sanitised with DOMPurify before insertion. This matters even
 * though the content comes from the admin's own rich text editor and not
 * directly from public visitors: it defends against stored XSS if an
 * admin account is ever compromised, and against any future integration
 * (import tools, migrations) that pipes untrusted HTML into content.
 */
export function RichText({ html, className }: { html: string; className?: string }) {
  const clean = sanitizeRichHtml(html);

  // Body images can be numerous (long posts, photo-heavy articles). Force
  // lazy loading on every one of them here so editors don't have to
  // remember to set it per-image, and so a post with many images doesn't
  // block the page.
  const lazyLoaded = clean.replace(/<img(?![^>]*\bloading=)/g, '<img loading="lazy"');

  return (
    <div
      // Pass className="prose-content" for the shared responsive typography
      // (headings, lists, quotes, links, spacing -- see index.css). Policy
      // pages get it from LegalPageLayout's wrapper instead.
      className={className}
      // eslint-disable-next-line react/no-danger -- sanitized above with DOMPurify
      dangerouslySetInnerHTML={{ __html: lazyLoaded }}
    />
  );
}
