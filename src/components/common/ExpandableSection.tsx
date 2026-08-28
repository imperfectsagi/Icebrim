import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Expand/collapse disclosure for long content sections (e.g. a long
 * custom page, or a long About page). Built on the native
 * <details>/<summary> elements rather than a custom open/closed React
 * state, so it's keyboard-accessible and functions correctly without
 * waiting on JS hydration.
 *
 * defaultOpen controls the *initial* state only (native <details> is
 * uncontrolled) -- that's intentional here, since content sections
 * don't need to be forced open/closed after the fact the way a
 * controlled form input would.
 */
export function ExpandableSection({
  title,
  defaultOpen = false,
  children,
  className,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <details
      open={defaultOpen}
      className={cn('group rounded-[var(--radius-card)] border border-[var(--color-line)]', className)}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 font-medium marker:content-none [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown size={18} className="shrink-0 transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="prose-content px-5 pb-5 text-[var(--color-ink-soft)]">{children}</div>
    </details>
  );
}
