import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Container({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('container-page', className)} {...props} />;
}

export function Badge({
  children,
  tone = 'ice',
  className,
}: {
  children: ReactNode;
  tone?: 'ice' | 'coral';
  className?: string;
}) {
  const toneStyles =
    tone === 'ice'
      ? 'bg-[var(--color-ice)] text-[#1c4b4f]'
      : 'bg-[var(--color-coral-tint)] text-[var(--color-coral-deep)]';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-[var(--radius-pill)] px-3 py-1 text-xs font-semibold tracking-wide uppercase',
        toneStyles,
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        'text-sm font-semibold tracking-[0.08em] uppercase text-[var(--color-coral-deep)] mb-3',
        className,
      )}
    >
      {children}
    </p>
  );
}

export function SectionHeading({
  eyebrow,
  heading,
  align = 'left',
  className,
}: {
  eyebrow?: string;
  heading: string;
  align?: 'left' | 'center';
  className?: string;
}) {
  return (
    <div className={cn(align === 'center' && 'text-center mx-auto', 'max-w-2xl', className)}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 className="text-3xl md:text-4xl font-medium text-[var(--color-ink)] text-balance">
        {heading}
      </h2>
    </div>
  );
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-card)] bg-white border border-[var(--color-line)] shadow-[var(--shadow-soft)]',
        className,
      )}
      {...props}
    />
  );
}
