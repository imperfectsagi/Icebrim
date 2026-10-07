/**
 * Server-side HTML sanitizer for admin-authored rich content (blog posts,
 * custom pages, policy pages, product descriptions).
 *
 * The Workers runtime has no DOM/`window`, so browser-DOM-based sanitizers
 * like DOMPurify can't run here, and Node-oriented libraries like
 * `sanitize-html` depend on Node internals that aren't available either.
 * Rather than pull in a heavyweight WASM HTML parser for a narrow,
 * well-understood input shape, this is a deliberately strict allowlist
 * sanitizer: it only permits the tag set our admin rich text editor
 * (`RichTextEditor.tsx`) can produce, strips everything else, and drops any
 * attribute outside a small allowlist with scheme-validated `href`/`src`.
 *
 * It also NORMALISES markup so what is stored is always clean, predictable
 * HTML that renders identically on mobile and desktop:
 *   - <div> blocks (which browsers' contentEditable and Word/Google Docs
 *     pastes produce) become <p> paragraphs, instead of being stripped on
 *     the public site and merging paragraphs together.
 *   - <b>/<i> become <strong>/<em>; <h1> becomes <h2> (the page title is
 *     already the one <h1>); <h5>/<h6> become <h4>.
 *   - Empty paragraphs (`<p><br></p>`) are removed so spacing comes from CSS
 *     rather than from stray blank lines.
 *   - Links get a safe `rel` automatically when they open in a new tab.
 *
 * This runs server-side as the authoritative sanitization step; the
 * frontend's DOMPurify pass (`RichText.tsx`) is defense-in-depth on top of
 * this, not a substitute for it.
 */

const ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'em', 'u', 's', 'a', 'ul', 'ol', 'li',
  'h2', 'h3', 'h4', 'blockquote', 'img', 'figure', 'figcaption', 'code', 'pre',
  'hr', 'details', 'summary',
]);

/** Tags that are rewritten to an allowed equivalent rather than dropped. */
const TAG_RENAMES: Record<string, string> = {
  b: 'strong',
  i: 'em',
  div: 'p',
  h1: 'h2',
  h5: 'h4',
  h6: 'h4',
  strike: 's',
  del: 's',
};

const VOID_TAGS = new Set(['br', 'img', 'hr']);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'target', 'rel']),
  img: new Set(['src', 'alt', 'title']),
  details: new Set(['open']),
};

const LINK_SCHEMES = ['http://', 'https://', 'mailto:', 'tel:', '/', '#'];
const IMAGE_SCHEMES = ['http://', 'https://', '/'];

function isSafeUrl(value: string, schemes: string[]): boolean {
  // Strip whitespace/control characters first: browsers ignore them inside a
  // scheme, so "java\tscript:" must not slip past a naive prefix check.
  const compact = value.replace(/[\u0000-\u0020\u007f]/g, '').toLowerCase();
  return schemes.some((scheme) => compact.startsWith(scheme));
}

function escapeAttr(value: string): string {
  return value.replace(/&(?!(?:amp|lt|gt|quot|#\d+|#x[0-9a-f]+);)/gi, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Matches a full tag, correctly treating a ">" inside a quoted attribute
// value as part of the value rather than the end of the tag.
const TAG_PATTERN = /<\/?([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/g;
const ATTR_PATTERN = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

function buildAttrs(tagName: string, attrsRaw: string): string {
  const allowed = ALLOWED_ATTRS[tagName];
  if (!allowed) return '';

  const found = new Map<string, string>();
  ATTR_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ATTR_PATTERN.exec(attrsRaw)) !== null) {
    const name = match[1]!.toLowerCase();
    if (!allowed.has(name) || found.has(name)) continue;
    found.set(name, match[2] ?? match[3] ?? match[4] ?? '');
  }

  let out = '';
  if (tagName === 'a') {
    const href = found.get('href');
    if (href !== undefined && isSafeUrl(href, LINK_SCHEMES)) out += ` href="${escapeAttr(href.trim())}"`;
    if (found.get('target') === '_blank') out += ' target="_blank" rel="noopener noreferrer"';
  } else if (tagName === 'img') {
    const src = found.get('src');
    if (src === undefined || !isSafeUrl(src, IMAGE_SCHEMES)) return ' src=""';
    out += ` src="${escapeAttr(src.trim())}"`;
    out += ` alt="${escapeAttr(found.get('alt') ?? '')}"`;
    if (found.has('title')) out += ` title="${escapeAttr(found.get('title')!)}"`;
  } else if (tagName === 'details') {
    if (found.has('open')) out += ' open';
  }
  return out;
}

/**
 * Strips disallowed tags/attributes from HTML and normalises the result.
 * Intentionally conservative: anything ambiguous is dropped rather than
 * passed through, since stored XSS is far worse than a lost formatting edge
 * case.
 */
export function sanitizeBlogHtml(html: string): string {
  // Strip script/style blocks entirely, including their content.
  let output = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');

  // Remove HTML comments (can hide malicious content in some parsers).
  output = output.replace(/<!--[\s\S]*?-->/g, '');

  output = output.replace(TAG_PATTERN, (match: string, tagNameRaw: string, attrsRaw: string) => {
    let tagName = tagNameRaw.toLowerCase();
    const isClosing = match.startsWith('</');
    tagName = TAG_RENAMES[tagName] ?? tagName;

    if (!ALLOWED_TAGS.has(tagName)) return ''; // drop disallowed tags entirely (their text is kept)

    if (isClosing) return VOID_TAGS.has(tagName) ? '' : `</${tagName}>`;

    const attrs = buildAttrs(tagName, attrsRaw);
    return `<${tagName}${attrs}>`;
  });

  // Normalisation passes ---------------------------------------------------

  // <div> -> <p> can leave a paragraph wrapping a block (<p><p>..</p></p>,
  // <p><ul>..</ul></p>). Unwrap those so the structure is valid.
  const BLOCK_OPEN = '(?:p|ul|ol|blockquote|h[2-4]|pre|figure|details|hr)';
  const BLOCK_CLOSE = '(?:p|ul|ol|blockquote|h[2-4]|pre|figure|details)';
  for (let i = 0; i < 3; i++) {
    output = output
      .replace(new RegExp(`<p>\\s*(<${BLOCK_OPEN}\\b)`, 'gi'), '$1')
      .replace(new RegExp(`(</${BLOCK_CLOSE}>|<hr>)\\s*</p>`, 'gi'), '$1');
  }

  // Remove empty paragraphs / headings (blank lines from the editor).
  output = output
    .replace(/<p>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>/gi, '')
    .replace(/<(h[2-4])>(?:\s|&nbsp;|<br\s*\/?>)*<\/\1>/gi, '');

  return output.trim();
}
