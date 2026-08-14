import { useRef, useEffect, useCallback } from 'react';
import { Bold, Italic, List, ListOrdered, Heading2, Link as LinkIcon } from 'lucide-react';

/**
 * A minimal rich text editor using the browser's built-in contentEditable
 * + execCommand. This intentionally avoids pulling in a full WYSIWYG
 * library (TipTap, Slate, etc.) to keep the bundle lean; it covers the
 * formatting options the Blog CMS spec calls for (bold, italic, lists,
 * headings, links). Output HTML is sanitized again server-side and via
 * <RichText> before ever being rendered on the public site.
 */
export function RichTextEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (ref.current && isFirstRender.current) {
      ref.current.innerHTML = value || '<p></p>';
      isFirstRender.current = false;
    }
  }, [value]);

  const exec = useCallback((command: string, arg?: string) => {
    document.execCommand(command, false, arg);
    ref.current?.focus();
    if (ref.current) onChange(ref.current.innerHTML);
  }, [onChange]);

  const handleLink = () => {
    const url = window.prompt('Enter URL');
    if (url) exec('createLink', url);
  };

  return (
    <div className="border border-[var(--color-line)] rounded-xl overflow-hidden">
      <div className="flex items-center gap-1 border-b border-[var(--color-line)] bg-[var(--color-surface)] px-2 py-1.5">
        <ToolbarButton label="Bold" onClick={() => exec('bold')}>
          <Bold size={14} />
        </ToolbarButton>
        <ToolbarButton label="Italic" onClick={() => exec('italic')}>
          <Italic size={14} />
        </ToolbarButton>
        <ToolbarButton label="Heading" onClick={() => exec('formatBlock', 'h2')}>
          <Heading2 size={14} />
        </ToolbarButton>
        <ToolbarButton label="Bullet list" onClick={() => exec('insertUnorderedList')}>
          <List size={14} />
        </ToolbarButton>
        <ToolbarButton label="Numbered list" onClick={() => exec('insertOrderedList')}>
          <ListOrdered size={14} />
        </ToolbarButton>
        <ToolbarButton label="Insert link" onClick={handleLink}>
          <LinkIcon size={14} />
        </ToolbarButton>
      </div>
      <div
        ref={ref}
        contentEditable
        role="textbox"
        aria-multiline="true"
        aria-label="Blog post content"
        className="prose-content px-4 py-3 min-h-[240px] focus:outline-none"
        onInput={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
      />
    </div>
  );
}

function ToolbarButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="p-2 rounded-lg hover:bg-white text-[var(--color-ink-soft)]"
    >
      {children}
    </button>
  );
}
