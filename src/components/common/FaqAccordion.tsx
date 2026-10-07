import { useId, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { RichText } from '@/components/common/RichText';
import { parseFaqContent } from '@/lib/html-content';
import { cn } from '@/lib/utils';

/**
 * Expand/collapse FAQ list.
 *
 * Each question is a real <button> (so it works with a tap, a click and the
 * keyboard) that opens its answer; pressing it again closes it. Every item
 * opens and closes independently. State is plain React state, so the
 * behaviour is identical on mobile and desktop -- there is no hover logic and
 * no dependency on the browser's native <details> handling.
 */
export function FaqAccordion({ items }: { items: { question: string; answerHtml: string }[] }) {
  const baseId = useId();
  const [openIndexes, setOpenIndexes] = useState<Set<number>>(() => new Set());

  const toggle = (index: number) =>
    setOpenIndexes((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });

  return (
    <div className="space-y-3">
      {items.map((item, index) => {
        const open = openIndexes.has(index);
        const buttonId = `${baseId}-q-${index}`;
        const panelId = `${baseId}-a-${index}`;
        return (
          <div key={buttonId} className="rounded-[var(--radius-card)] border border-[var(--color-line)] bg-white">
            <h3 className="m-0">
              <button
                type="button"
                id={buttonId}
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => toggle(index)}
                className="flex w-full min-h-[3.25rem] items-center justify-between gap-4 px-5 py-4 text-left font-medium text-[var(--color-ink)]"
              >
                <span className="font-display text-base md:text-lg leading-snug text-[var(--color-ink)]">{item.question}</span>
                <ChevronDown
                  size={18}
                  aria-hidden="true"
                  className={cn('shrink-0 transition-transform duration-200', open && 'rotate-180')}
                />
              </button>
            </h3>
            {/* Collapsed answers are removed from view AND from the tab order. */}
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              hidden={!open}
              className="px-5 pb-5"
            >
              <RichText html={item.answerHtml} className="prose-content" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Renders FAQ-shaped rich content (see parseFaqContent for how questions
 * are recognised) as an accordion, with any intro text shown above it.
 * Returns null when the content has no questions, so callers can fall back
 * to normal rendering.
 */
export function FaqContent({ html }: { html: string }) {
  const parsed = useMemo(() => parseFaqContent(html), [html]);
  if (parsed.items.length === 0) return null;
  return (
    <div>
      {parsed.introHtml && <RichText html={parsed.introHtml} className="prose-content mb-8" />}
      <FaqAccordion items={parsed.items} />
    </div>
  );
}
