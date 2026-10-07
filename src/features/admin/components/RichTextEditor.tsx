import { useRef, useEffect, useCallback, useState } from 'react';
import {
  Bold, Italic, List, ListOrdered, Heading2, Heading3, Pilcrow, Link as LinkIcon, Unlink,
  Quote, Undo2, Redo2, Code, RemoveFormatting,
} from 'lucide-react';
import { sanitizeRichHtml } from '@/components/common/RichText';
import { isEmptyHtml, normalizeContentHtml, normalizePastedHtml, plainTextToHtml } from '@/lib/html-content';

/**
 * Rich text editor used by every admin content field that is published as
 * formatted content: blog posts, pages (incl. About / FAQ), policy pages and
 * product descriptions.
 *
 * Built on the browser's contentEditable + execCommand (no heavy WYSIWYG
 * dependency). What it supports:
 *   - Paragraph, Heading 2, Heading 3
 *   - Bold, Italic
 *   - Bullet and numbered lists
 *   - Blockquote (click again to remove)
 *   - Links (https, mailto, tel, internal paths; optional "new tab")
 *   - Undo / Redo / Clear formatting
 *   - An "HTML" view for pasting or tweaking raw HTML
 *   - Clean paste: text copied from Word / Google Docs / a web page is
 *     reduced to the same allowed formatting instead of dragging in fonts,
 *     colours and stray markup.
 *
 * The editor area uses the same `prose-content` styles as the live site, so
 * what you see here is how it will look. The Worker sanitises the HTML again
 * on save (workers/src/lib/sanitize-html.ts) and <RichText> sanitises again
 * on display -- the editor is a convenience, not the security boundary.
 */

type Mode = 'visual' | 'html';

const BLOCK_TAGS = new Set(['P', 'H2', 'H3', 'H4', 'BLOCKQUOTE', 'LI', 'PRE', 'DIV']);

/** Turns what an admin typed into a safe URL, or null if it isn't one. */
export function normalizeLinkUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value || /\s/.test(value)) return null;
  if (/^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i.test(value)) return value;
  if (/^[^@\s/]+@[^@\s/]+\.[^@\s/]+$/.test(value)) return `mailto:${value}`;
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(value)) return `https://${value}`;
  return null;
}

export function RichTextEditor({
  value,
  onChange,
  ariaLabel = 'Rich text content',
  minHeight = 260,
  hint,
}: {
  value: string;
  onChange: (html: string) => void;
  ariaLabel?: string;
  minHeight?: number;
  /** Optional helper text shown under the toolbar. */
  hint?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const lastEmitted = useRef<string | null>(null);
  const savedRange = useRef<Range | null>(null);
  const [mode, setMode] = useState<Mode>('visual');
  const [source, setSource] = useState('');
  const [active, setActive] = useState({ bold: false, italic: false, ul: false, ol: false, block: 'P' });
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkNewTab, setLinkNewTab] = useState(false);
  const [linkError, setLinkError] = useState('');
  const linkInputRef = useRef<HTMLInputElement>(null);

  // ---- value <-> DOM sync ---------------------------------------------
  // Initial content AND content that arrives later (editing an existing
  // post: the form is reset once the saved data has loaded) both flow
  // through here. Only content that did NOT come from this editor's own
  // onChange is written into the DOM, so typing never fights the cursor.
  useEffect(() => {
    const el = ref.current;
    if (!el || mode !== 'visual') return;
    if (lastEmitted.current !== null && value === lastEmitted.current) return;
    el.innerHTML = sanitizeRichHtml(value) || '<p><br></p>';
    lastEmitted.current = value;
  }, [value, mode]);

  useEffect(() => {
    try {
      // Make Enter create <p> paragraphs instead of <div> blocks.
      document.execCommand('defaultParagraphSeparator', false, 'p');
    } catch {
      /* not supported -- the server also converts <div> to <p> */
    }
  }, []);

  const emit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const html = isEmptyHtml(el.innerHTML) ? '' : normalizeContentHtml(el.innerHTML);
    lastEmitted.current = html;
    onChange(html);
  }, [onChange]);

  // ---- toolbar state ----------------------------------------------------
  const closestBlock = useCallback((): Element | null => {
    const sel = window.getSelection();
    const root = ref.current;
    if (!sel || !sel.anchorNode || !root || !root.contains(sel.anchorNode)) return null;
    let node: Node | null = sel.anchorNode;
    while (node && node !== root) {
      if (node.nodeType === 1 && BLOCK_TAGS.has((node as Element).tagName)) return node as Element;
      node = node.parentNode;
    }
    return null;
  }, []);

  const insideTag = useCallback((tag: string): boolean => {
    const sel = window.getSelection();
    const root = ref.current;
    if (!sel || !sel.anchorNode || !root || !root.contains(sel.anchorNode)) return false;
    let node: Node | null = sel.anchorNode;
    while (node && node !== root) {
      if (node.nodeType === 1 && (node as Element).tagName === tag) return true;
      node = node.parentNode;
    }
    return false;
  }, []);

  useEffect(() => {
    const update = () => {
      const root = ref.current;
      const sel = window.getSelection();
      if (!root || !sel || !sel.anchorNode || !root.contains(sel.anchorNode)) return;
      const block = closestBlock();
      let blockTag = block?.tagName ?? 'P';
      if (blockTag === 'LI' || blockTag === 'DIV') blockTag = 'P';
      setActive({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        ul: insideTag('UL'),
        ol: insideTag('OL'),
        block: insideTag('BLOCKQUOTE') ? 'BLOCKQUOTE' : blockTag,
      });
    };
    document.addEventListener('selectionchange', update);
    return () => document.removeEventListener('selectionchange', update);
  }, [closestBlock, insideTag]);

  // ---- commands -----------------------------------------------------------
  const focusEditor = () => {
    const el = ref.current;
    if (el && document.activeElement !== el) el.focus();
  };

  /** Is the caret (collapsed) sitting at the very end of a non-empty block? */
  const caretAtEndOfBlock = useCallback((): boolean => {
    const sel = window.getSelection();
    const block = closestBlock();
    if (!sel || !sel.isCollapsed || !sel.anchorNode || !block) return false;
    const range = document.createRange();
    range.selectNodeContents(block);
    range.setStart(sel.anchorNode, sel.anchorOffset);
    return range.toString().length === 0 && (block.textContent ?? '').length > 0;
  }, [closestBlock]);

  /**
   * Browsers leave two rough edges after block-level commands: a list or
   * quote created from a paragraph can end up nested INSIDE that <p>
   * (invalid HTML that then behaves oddly when you press Enter), and the
   * caret can jump to the start of the text. Tidy both so typing carries on
   * naturally where the editor left off.
   */
  const tidyAfterBlockCommand = useCallback((restoreCaretToEnd: boolean) => {
    const root = ref.current;
    if (!root) return;
    root.querySelectorAll('p > ul, p > ol, p > blockquote, p > h2, p > h3, p > h4, p > p').forEach((child) => {
      const parent = child.parentElement;
      if (parent && parent.tagName === 'P' && parent !== root && parent.children.length === 1 && !(parent.textContent ?? '').replace(child.textContent ?? '', '').trim()) {
        parent.replaceWith(child);
      }
    });
    if (restoreCaretToEnd) {
      const block = closestBlock();
      const sel = window.getSelection();
      if (block && sel) {
        const range = document.createRange();
        range.selectNodeContents(block);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
  }, [closestBlock]);

  /** Runs a block-level command (list, heading, quote) with the tidy-up above. */
  const execBlock = useCallback(
    (run: () => void) => {
      focusEditor();
      const atEnd = caretAtEndOfBlock();
      run();
      tidyAfterBlockCommand(atEnd);
      emit();
    },
    [caretAtEndOfBlock, tidyAfterBlockCommand, emit],
  );

  const exec = useCallback(
    (command: string, arg?: string) => {
      focusEditor();
      document.execCommand(command, false, arg);
      emit();
    },
    [emit],
  );

  const setBlock = (tag: 'P' | 'H2' | 'H3') =>
    execBlock(() => {
      if (insideTag('BLOCKQUOTE')) document.execCommand('outdent');
      const current = closestBlock()?.tagName;
      // Clicking the active heading again turns it back into a paragraph.
      document.execCommand('formatBlock', false, `<${current === tag ? 'P' : tag}>`);
    });

  const toggleQuote = () =>
    execBlock(() => {
      if (insideTag('BLOCKQUOTE')) document.execCommand('outdent');
      else document.execCommand('formatBlock', false, '<BLOCKQUOTE>');
    });

  const toggleList = (command: 'insertUnorderedList' | 'insertOrderedList') =>
    execBlock(() => {
      document.execCommand(command);
    });

  const clearFormatting = () => {
    focusEditor();
    document.execCommand('removeFormat');
    if (insideTag('BLOCKQUOTE')) document.execCommand('outdent');
    document.execCommand('formatBlock', false, '<P>');
    document.execCommand('unlink');
    emit();
  };

  // ---- links --------------------------------------------------------------
  const openLinkPanel = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && ref.current?.contains(sel.anchorNode)) {
      savedRange.current = sel.getRangeAt(0).cloneRange();
      let node: Node | null = sel.anchorNode;
      let existing: HTMLAnchorElement | null = null;
      while (node && node !== ref.current) {
        if (node.nodeType === 1 && (node as Element).tagName === 'A') {
          existing = node as HTMLAnchorElement;
          break;
        }
        node = node.parentNode;
      }
      setLinkUrl(existing?.getAttribute('href') ?? '');
      setLinkNewTab(existing?.getAttribute('target') === '_blank');
    } else {
      savedRange.current = null;
      setLinkUrl('');
      setLinkNewTab(false);
    }
    setLinkError('');
    setLinkOpen(true);
    window.setTimeout(() => linkInputRef.current?.focus(), 0);
  };

  const applyLink = () => {
    const url = normalizeLinkUrl(linkUrl);
    if (!url) {
      setLinkError('Enter a full web address (e.g. https://example.com), an email address, or a page path like /products.');
      return;
    }
    focusEditor();
    const sel = window.getSelection();
    if (savedRange.current && sel) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
    const collapsed = !sel || sel.isCollapsed;
    if (collapsed) {
      const label = url.replace(/^(mailto:|tel:|https?:\/\/)/i, '');
      const a = document.createElement('a');
      a.setAttribute('href', url);
      a.textContent = label;
      document.execCommand('insertHTML', false, a.outerHTML);
    } else {
      document.execCommand('createLink', false, url);
    }
    // execCommand can't set target/rel, so patch the anchors it produced.
    const external = /^https?:\/\//i.test(url);
    ref.current?.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((a) => {
      if (a.getAttribute('href') !== url) return;
      if (linkNewTab && external) {
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
      } else {
        a.removeAttribute('target');
        a.removeAttribute('rel');
      }
    });
    emit();
    setLinkOpen(false);
    savedRange.current = null;
  };

  // ---- paste ----------------------------------------------------------------
  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');
    if (!html && !text) return;
    e.preventDefault();

    let clean = html ? sanitizeRichHtml(normalizePastedHtml(html)) : plainTextToHtml(text);
    if (!clean && text) clean = plainTextToHtml(text);
    // A single pasted paragraph goes inline into the current paragraph
    // instead of splitting it in two.
    const single = /^<p>([\s\S]*)<\/p>$/.exec(clean);
    if (single && !/<\/?p>/.test(single[1]!)) clean = single[1]!;
    document.execCommand('insertHTML', false, clean);
    emit();
  };

  // ---- HTML view ------------------------------------------------------------
  const toggleMode = () => {
    if (mode === 'visual') {
      setSource(ref.current ? normalizeContentHtml(ref.current.innerHTML) : value);
      setLinkOpen(false);
      setMode('html');
    } else {
      // Back to the visual editor: show the cleaned version of whatever was
      // typed in the HTML box, and report that same cleaned HTML so the
      // form value always matches what is on screen.
      const cleaned = sanitizeRichHtml(source);
      lastEmitted.current = null; // force the sync effect to repaint the new visual area
      setMode('visual');
      onChange(cleaned);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openLinkPanel();
    }
  };

  const htmlMode = mode === 'html';

  return (
    <div className="border border-[var(--color-line)] rounded-xl overflow-hidden bg-white">
      <div
        role="toolbar"
        aria-label="Formatting"
        className="flex flex-wrap items-center gap-1 border-b border-[var(--color-line)] bg-[var(--color-surface)] px-2 py-1.5"
      >
        <ToolbarButton label="Paragraph" active={active.block === 'P'} disabled={htmlMode} onClick={() => setBlock('P')}>
          <Pilcrow size={16} />
        </ToolbarButton>
        <ToolbarButton label="Heading 2 (main section)" active={active.block === 'H2'} disabled={htmlMode} onClick={() => setBlock('H2')}>
          <Heading2 size={16} />
        </ToolbarButton>
        <ToolbarButton label="Heading 3 (sub-section)" active={active.block === 'H3'} disabled={htmlMode} onClick={() => setBlock('H3')}>
          <Heading3 size={16} />
        </ToolbarButton>
        <Divider />
        <ToolbarButton label="Bold" active={active.bold} disabled={htmlMode} onClick={() => exec('bold')}>
          <Bold size={16} />
        </ToolbarButton>
        <ToolbarButton label="Italic" active={active.italic} disabled={htmlMode} onClick={() => exec('italic')}>
          <Italic size={16} />
        </ToolbarButton>
        <Divider />
        <ToolbarButton label="Bullet list" active={active.ul} disabled={htmlMode} onClick={() => toggleList('insertUnorderedList')}>
          <List size={16} />
        </ToolbarButton>
        <ToolbarButton label="Numbered list" active={active.ol} disabled={htmlMode} onClick={() => toggleList('insertOrderedList')}>
          <ListOrdered size={16} />
        </ToolbarButton>
        <ToolbarButton label="Blockquote" active={active.block === 'BLOCKQUOTE'} disabled={htmlMode} onClick={toggleQuote}>
          <Quote size={16} />
        </ToolbarButton>
        <Divider />
        <ToolbarButton label="Insert link (Ctrl+K)" disabled={htmlMode} onClick={openLinkPanel}>
          <LinkIcon size={16} />
        </ToolbarButton>
        <ToolbarButton label="Remove link" disabled={htmlMode} onClick={() => exec('unlink')}>
          <Unlink size={16} />
        </ToolbarButton>
        <Divider />
        <ToolbarButton label="Undo" disabled={htmlMode} onClick={() => exec('undo')}>
          <Undo2 size={16} />
        </ToolbarButton>
        <ToolbarButton label="Redo" disabled={htmlMode} onClick={() => exec('redo')}>
          <Redo2 size={16} />
        </ToolbarButton>
        <ToolbarButton label="Clear formatting" disabled={htmlMode} onClick={clearFormatting}>
          <RemoveFormatting size={16} />
        </ToolbarButton>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={toggleMode}
          aria-pressed={htmlMode}
          title={htmlMode ? 'Back to visual editor' : 'Edit the HTML'}
          className={`ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold ${
            htmlMode ? 'bg-[var(--color-coral)] text-white' : 'text-[var(--color-ink-soft)] hover:bg-white'
          }`}
        >
          <Code size={15} aria-hidden="true" />
          HTML
        </button>
      </div>

      {linkOpen && !htmlMode && (
        <div className="border-b border-[var(--color-line)] bg-white px-3 py-2.5 space-y-2" role="group" aria-label="Insert link">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              ref={linkInputRef}
              type="text"
              inputMode="url"
              value={linkUrl}
              onChange={(e) => {
                setLinkUrl(e.target.value);
                setLinkError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  applyLink();
                } else if (e.key === 'Escape') setLinkOpen(false);
              }}
              placeholder="https://example.com or /products"
              aria-label="Link address"
              className="form-input flex-1"
            />
            <div className="flex gap-2">
              <button type="button" onClick={applyLink} className="rounded-lg bg-[var(--color-coral)] px-4 py-2 text-sm font-semibold text-white">
                Apply
              </button>
              <button type="button" onClick={() => setLinkOpen(false)} className="rounded-lg border border-[var(--color-line)] px-4 py-2 text-sm font-medium">
                Cancel
              </button>
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-[var(--color-ink-soft)]">
            <input type="checkbox" checked={linkNewTab} onChange={(e) => setLinkNewTab(e.target.checked)} className="h-3.5 w-3.5" />
            Open external links in a new tab
          </label>
          {linkError && (
            <p role="alert" className="text-xs text-[var(--color-coral-deep)]">
              {linkError}
            </p>
          )}
        </div>
      )}

      {hint && !htmlMode && <p className="border-b border-[var(--color-line)] px-3 py-1.5 text-xs text-[var(--color-ink-soft)]">{hint}</p>}

      {htmlMode ? (
        <textarea
          value={source}
          onChange={(e) => {
            setSource(e.target.value);
            lastEmitted.current = e.target.value;
            onChange(e.target.value);
          }}
          spellCheck={false}
          aria-label={`${ariaLabel} (HTML)`}
          className="block w-full resize-y px-4 py-3 font-mono text-[13px] leading-relaxed focus:outline-none"
          style={{ minHeight }}
        />
      ) : (
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label={ariaLabel}
          className="prose-content px-4 py-3 focus:outline-none"
          style={{ minHeight }}
          onInput={emit}
          onBlur={emit}
          onPaste={handlePaste}
          onKeyDown={onKeyDown}
        />
      )}
    </div>
  );
}

function Divider() {
  return <span className="mx-0.5 h-5 w-px bg-[var(--color-line)]" aria-hidden="true" />;
}

function ToolbarButton({
  label,
  onClick,
  children,
  active = false,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      // Keep the text selection inside the editor when a toolbar button is
      // pressed (mouse and touch) -- otherwise the command has nothing to act on.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg disabled:opacity-35 ${
        active ? 'bg-white text-[var(--color-ink)] shadow-sm ring-1 ring-[var(--color-line)]' : 'text-[var(--color-ink-soft)] hover:bg-white'
      }`}
    >
      {children}
    </button>
  );
}
