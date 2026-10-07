/**
 * Helpers shared by everything that renders admin-authored rich content
 * (blog posts, custom pages, policy pages, product descriptions) and by the
 * rich text editor itself.
 */

const HAS_TAG = /<\/?[a-z][\s\S]*?>/i;

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Plain text -> paragraphs (blank line = new paragraph, single newline = <br>), HTML-escaped. */
export function plainTextToHtml(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => `<p>${escapeHtml(chunk).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/**
 * Makes older / differently-shaped stored content render with proper
 * paragraph structure:
 *  - Plain text (no HTML at all, e.g. product descriptions written before
 *    they had a rich editor) becomes paragraphs: blank lines split
 *    paragraphs, single line breaks become <br>.
 *  - <div> blocks (what contentEditable produced before the editor was
 *    fixed) become <p>, instead of being stripped and merging every
 *    paragraph into one block of text.
 *  - Empty paragraphs are removed -- spacing comes from CSS.
 */
export function normalizeContentHtml(html: string): string {
  const source = (html ?? '').trim();
  if (!source) return '';

  if (!HAS_TAG.test(source)) return plainTextToHtml(source);

  let out = source.replace(/<div(\s[^>]*)?>/gi, '<p>').replace(/<\/div>/gi, '</p>');
  const BLOCK_OPEN = '(?:p|ul|ol|blockquote|h[2-4]|pre|figure|details|hr)';
  const BLOCK_CLOSE = '(?:p|ul|ol|blockquote|h[2-4]|pre|figure|details)';
  for (let i = 0; i < 3; i++) {
    out = out
      .replace(new RegExp(`<p>\\s*(<${BLOCK_OPEN}\\b)`, 'gi'), '$1')
      .replace(new RegExp(`(</${BLOCK_CLOSE}>|<hr\\s*/?>)\\s*</p>`, 'gi'), '$1');
  }
  return out.replace(/<p>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>/gi, '');
}

/** True when the editor's HTML has no real content (only empty blocks / whitespace). */
export function isEmptyHtml(html: string): boolean {
  if (!html) return true;
  if (/<(img|hr|iframe|video)\b/i.test(html)) return false;
  const text = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
  return text.length === 0;
}

/** Is this page meant to be a FAQ (shown as an expand/collapse accordion)? */
export function isFaqPage(slug: string, title: string): boolean {
  return /(^|-)faqs?(-|$)|frequently-asked/i.test(slug) || /\bfaqs?\b|frequently asked/i.test(title);
}

export interface FaqItem {
  question: string;
  /** Sanitised HTML for the answer. */
  answerHtml: string;
}

export interface FaqContent {
  /** Any content before the first question (an intro paragraph). */
  introHtml: string;
  items: FaqItem[];
}

const QUESTION_HEADING = /^H[2-4]$/;

function isBoldQuestionParagraph(el: Element): boolean {
  if (el.tagName !== 'P') return false;
  const text = (el.textContent ?? '').trim();
  if (!text.endsWith('?')) return false;
  const first = el.firstElementChild;
  return !!first && /^(STRONG|B)$/.test(first.tagName) && (first.textContent ?? '').trim() === text;
}

/**
 * Splits FAQ-shaped content into questions and answers. A question is:
 *   - a heading (H2/H3/H4) -- everything up to the next heading is its answer;
 *   - a paragraph that is entirely bold and ends with "?";
 *   - or a <details><summary>Question</summary>Answer</details> block.
 * Content before the first question is returned as an intro.
 * Needs the browser's DOMParser; returns no items elsewhere (callers then
 * fall back to rendering the content normally).
 */
export function parseFaqContent(html: string): FaqContent {
  const empty: FaqContent = { introHtml: html, items: [] };
  if (typeof DOMParser === 'undefined') return empty;

  const doc = new DOMParser().parseFromString(`<body>${normalizeContentHtml(html)}</body>`, 'text/html');
  const intro: string[] = [];
  const items: { question: string; parts: string[] }[] = [];
  let current: { question: string; parts: string[] } | null = null;

  for (const node of Array.from(doc.body.childNodes)) {
    const isEl = node.nodeType === 1;
    const el = isEl ? (node as Element) : null;
    const outer = el ? el.outerHTML : escapeHtml(node.textContent ?? '');

    if (el && el.tagName === 'DETAILS') {
      const summary = el.querySelector('summary');
      const question = (summary?.textContent ?? '').trim();
      if (summary) summary.remove();
      if (question) {
        items.push({ question, parts: [el.innerHTML] });
        current = null;
        continue;
      }
    }

    if (el && (QUESTION_HEADING.test(el.tagName) || isBoldQuestionParagraph(el))) {
      const question = (el.textContent ?? '').trim();
      if (question) {
        current = { question, parts: [] };
        items.push(current);
        continue;
      }
    }

    if (!outer.trim()) continue;
    if (current) current.parts.push(outer);
    else intro.push(outer);
  }

  return {
    introHtml: intro.join(''),
    items: items.map((i) => ({ question: i.question, answerHtml: i.parts.join('') })),
  };
}

function renameElement(el: Element, tag: string) {
  const replacement = el.ownerDocument.createElement(tag);
  while (el.firstChild) replacement.appendChild(el.firstChild);
  el.replaceWith(replacement);
}

function unwrapElement(el: Element) {
  while (el.firstChild) el.parentNode?.insertBefore(el.firstChild, el);
  el.remove();
}

/**
 * Prepares HTML copied from Word / Google Docs / a web page for the editor.
 * Those apps express bold and italic as <b>/<i> or as styled <span>s (Google
 * Docs even wraps everything in <b style="font-weight:normal">); the
 * sanitiser only keeps <strong>/<em>, so without this step pasted bold text
 * would silently lose its formatting -- or the whole paste would turn bold.
 */
export function normalizePastedHtml(html: string): string {
  if (typeof DOMParser === 'undefined') return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');

  // Wrappers that merely say "not bold" / "not italic" (Google Docs).
  doc.querySelectorAll<HTMLElement>('b, strong').forEach((el) => {
    if (el.style.fontWeight === 'normal' || el.style.fontWeight === '400') unwrapElement(el);
  });
  doc.querySelectorAll<HTMLElement>('i, em').forEach((el) => {
    if (el.style.fontStyle === 'normal') unwrapElement(el);
  });

  // Styled spans -> real <strong>/<em> (nested when both apply).
  doc.querySelectorAll<HTMLElement>('span').forEach((span) => {
    const bold = span.style.fontWeight === 'bold' || Number(span.style.fontWeight) >= 600;
    const italic = span.style.fontStyle === 'italic';
    if (!bold && !italic) return;
    let outer: Element | null = null;
    let inner: Element | null = null;
    if (bold) {
      outer = doc.createElement('strong');
      inner = outer;
    }
    if (italic) {
      const em = doc.createElement('em');
      if (inner) inner.appendChild(em);
      else outer = em;
      inner = em;
    }
    while (span.firstChild) inner!.appendChild(span.firstChild);
    span.replaceWith(outer!);
  });

  doc.querySelectorAll('b').forEach((el) => renameElement(el, 'strong'));
  doc.querySelectorAll('i').forEach((el) => renameElement(el, 'em'));
  return doc.body.innerHTML;
}
