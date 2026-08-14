import { useId, cloneElement, type ReactElement, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';

export function AdminPageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex items-start justify-between mb-8 gap-4">
      <div>
        <h1 className="font-display text-2xl font-medium mb-1">{title}</h1>
        {description && <p className="text-sm text-[var(--color-ink-soft)]">{description}</p>}
      </div>
      {action && (
        <Button size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

export function AdminCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`bg-white rounded-[var(--radius-card)] border border-[var(--color-line)] p-6 ${className ?? ''}`}
    >
      {children}
    </div>
  );
}

export function FormRow({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactElement<{ id?: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }>;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error && errorId, hint && !error && hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium mb-1.5">
        {label}
      </label>
      {cloneElement(children, { id, 'aria-invalid': !!error, 'aria-describedby': describedBy })}
      {hint && !error && (
        <p id={hintId} className="text-xs text-[var(--color-ink-soft)] mt-1">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs text-[var(--color-coral-deep)] mt-1">
          {error}
        </p>
      )}
      <style>{`
        input.form-input, textarea.form-input, select.form-input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid var(--color-line);
          padding: 0.6rem 0.85rem;
          font-size: 0.9rem;
          background-color: #ffffff;
          color: var(--color-ink);
          /* Force a light UA color scheme on this control so mobile
             browsers in system dark mode don't swap in white-on-white
             (or otherwise unreadable) native form-control colors. */
          color-scheme: light;
        }
        input.form-input::placeholder, textarea.form-input::placeholder {
          color: var(--color-ink-soft);
          opacity: 1;
        }
        input.form-input:focus-visible, textarea.form-input:focus-visible, select.form-input:focus-visible {
          outline: 2px solid var(--color-coral-deep);
          outline-offset: 2px;
        }
      `}</style>
    </div>
  );
}
