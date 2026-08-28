import { useState, useRef, useLayoutEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { RichText } from '@/components/common/RichText';

// Below this rendered height, content just displays in full -- collapsing
// a short page would only add an unnecessary extra click. Only genuinely
// long content sections (the requirement this satisfies) get collapsed.
const COLLAPSE_THRESHOLD_PX = 480;

/**
 * Wraps RichText with an expand/collapse "Read more" affordance for long
 * content sections (a long custom Page, or the About page). Short content
 * renders in full with no collapse UI at all -- the threshold is measured
 * against the actual rendered height, not a guess at character count, so
 * it adapts correctly to different content (a few long paragraphs vs.
 * many short ones, embedded images, etc).
 */
export function ReadMoreSection({ html, className }: { html: string; className?: string }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [isLong, setIsLong] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useLayoutEffect(() => {
    if (contentRef.current) {
      setIsLong(contentRef.current.scrollHeight > COLLAPSE_THRESHOLD_PX);
    }
  }, [html]);

  return (
    <div>
      <div
        ref={contentRef}
        style={!isLong || expanded ? undefined : { maxHeight: COLLAPSE_THRESHOLD_PX, overflow: 'hidden', position: 'relative' }}
      >
        <RichText html={html} className={className ?? 'prose-content'} />
        {isLong && !expanded && (
          <div
            className="pointer-events-none absolute bottom-0 left-0 right-0 h-24"
            style={{ background: 'linear-gradient(to bottom, transparent, #ffffff)' }}
            aria-hidden="true"
          />
        )}
      </div>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-coral-deep)]"
          aria-expanded={expanded}
        >
          {expanded ? 'Show less' : 'Read more'}
          <ChevronDown size={15} className={expanded ? 'rotate-180 transition-transform' : 'transition-transform'} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
