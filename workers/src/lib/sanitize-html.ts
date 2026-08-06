/**
 * Server-side HTML sanitizer for blog post content.
 *
 * The Workers runtime has no DOM/`window`, so browser-DOM-based sanitizers
 * like DOMPurify can't run here, and Node-oriented libraries like
 * `sanitize-html` depend on Node internals (`process`, etc.) that aren't
 * available either. Rather than pull in a heavyweight WASM HTML parser
 * for a narrow, well-understood input shape, this is a deliberately
 * strict allowlist sanitizer: it only permits the exact tag set our own
 * admin rich text editor (`RichTextEditor.tsx`) can produce, strips
 * everything else, and drops any attribute other than a small allowlist
 * with scheme-validated `href`/`src`.
 *
 * This runs server-side as the authoritative sanitization step; the
 * frontend's DOMPurify pass (`RichText.tsx`) is defense-in-depth on top
 * of this, not a substitute for it.
 */

const ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'em', 'u', 's', 'a', 'ul', 'ol', 'li',
  'h2', 'h3', 'h4', 'blockquote', 'img', 'figure', 'figcaption', 'code', 'pre', 'div',
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'target', 'rel']),
  img: new Set(['src', 'alt', 'title']),
};

const SAFE_URL_SCHEMES = ['http://', 'https://', '/', '#'];

function isSafeUrl(value: string): boolean {
  const trimmed = value.trim().toLowerCase();
  return SAFE_URL_SCHEMES.some((scheme) => trimmed.startsWith(scheme));
}

/**
 * Strips disallowed tags/attributes from HTML using a tokenizing regex
 * pass. This is intentionally conservative: anything ambiguous is
 * dropped rather than passed through, since the failure mode we care
 * about (stored XSS) is far worse than a formatting edge case being lost.
 */
export function sanitizeBlogHtml(html: string): string {
  // Strip script/style blocks entirely, including their content.
  let output = html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '');

  // Remove HTML comments (can hide malicious content in some parsers).
  output = output.replace(/<!--[\s\S]*?-->/g, '');

  // Process each tag occurrence.
  output = output.replace(/<\/?([a-zA-Z0-9]+)([^>]*)>/g, (match, tagNameRaw: string, attrsRaw: string) => {
    const tagName = tagNameRaw.toLowerCase();
    const isClosing = match.startsWith('</');

    if (!ALLOWED_TAGS.has(tagName)) return ''; // drop disallowed tags entirely

    if (isClosing) return `</${tagName}>`;

    const isSelfClosing = /\/\s*$/.test(attrsRaw);
    const allowedForTag = ALLOWED_ATTRS[tagName];
    let safeAttrs = '';

    if (allowedForTag) {
      const attrPattern = /([a-zA-Z-]+)\s*=\s*"([^"]*)"|([a-zA-Z-]+)\s*=\s*'([^']*)'/g;
      let attrMatch: RegExpExecArray | null;
      while ((attrMatch = attrPattern.exec(attrsRaw)) !== null) {
        const attrName = (attrMatch[1] ?? attrMatch[3]).toLowerCase();
        const attrValue = attrMatch[2] ?? attrMatch[4] ?? '';
        if (!allowedForTag.has(attrName)) continue;

        if ((attrName === 'href' || attrName === 'src') && !isSafeUrl(attrValue)) continue;
        if (attrName === 'target' && attrValue !== '_blank') continue;

        const escapedValue = attrValue.replace(/"/g, '&quot;');
        safeAttrs += ` ${attrName}="${escapedValue}"`;
      }
      // Force safe rel on links that open in a new tab.
      if (tagName === 'a' && /target\s*=\s*"?_blank/.test(attrsRaw)) {
        safeAttrs += ' rel="noopener noreferrer"';
      }
    }

    return `<${tagName}${safeAttrs}${isSelfClosing ? ' /' : ''}>`;
  });

  return output.trim();
}
