import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Lightweight modal used for admin edit dialogs (gallery image edit,
 * review edit, etc). Closes on Escape or backdrop click, moves focus into
 * the dialog on open, traps Tab/Shift+Tab within it while open (so
 * keyboard users can't tab out to page content hidden behind the
 * backdrop), and restores focus to whatever triggered it on close.
 */
export function AdminModal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    // Focus the dialog container itself first (not a specific field --
    // this is a generic modal used for several different forms, so there's
    // no single "first field" to assume). It's focusable via tabIndex=-1
    // below, which lets screen readers announce the dialog immediately
    // without arbitrarily picking one of its inputs to focus.
    dialogRef.current?.focus();

    return () => {
      // Restore focus to whatever opened the modal (e.g. the "Edit" button
      // in a DataTable row) so keyboard users land back where they were,
      // instead of focus silently resetting to <body>.
      previouslyFocused.current?.focus();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;

      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;

      // Wrap Tab/Shift+Tab at the dialog's edges instead of letting it
      // escape to whatever's behind the backdrop.
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-[var(--radius-card)] border border-[var(--color-line)] shadow-[var(--shadow-lift)] p-6 focus:outline-none"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-lg font-medium">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg hover:bg-[var(--color-surface-alt)] text-[var(--color-ink-soft)]"
          >
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
