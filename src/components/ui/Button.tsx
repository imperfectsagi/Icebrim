import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

const variantStyles: Record<Variant, string> = {
  primary:
    'bg-[var(--color-coral)] text-white hover:bg-[var(--color-coral-deep)] shadow-[var(--shadow-soft)]',
  secondary:
  'bg-white text-[var(--color-ice-deep)] border border-[var(--color-ice-deep)] hover:bg-[var(--color-ice-deep)] hover:text-white hover:border-[var(--color-ice-deep)]',
  ghost: 'bg-transparent text-[var(--color-ink)] hover:bg-[var(--color-surface-alt)]',
};

const sizeStyles: Record<Size, string> = {
  sm: 'text-sm px-4 py-2',
  md: 'text-base px-5 py-2.5',
  lg: 'text-base px-7 py-3.5',
};

const baseStyles =
  'inline-flex items-center justify-center gap-2 rounded-[var(--radius-pill)] font-semibold transition-colors duration-200 disabled:opacity-50 disabled:pointer-events-none';

interface CommonProps {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}

type ButtonAsButton = CommonProps &
  ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };

type ButtonAsInternalLink = CommonProps & { href: string; external?: false } & Omit<
    AnchorHTMLAttributes<HTMLAnchorElement>,
    'href'
  >;

type ButtonAsExternalLink = CommonProps & { href: string; external: true } & Omit<
    AnchorHTMLAttributes<HTMLAnchorElement>,
    'href'
  >;

export type ButtonProps = ButtonAsButton | ButtonAsInternalLink | ButtonAsExternalLink;

export const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className, children, ...rest }, ref) => {
    const classes = cn(baseStyles, variantStyles[variant], sizeStyles[size], className);

    if ('href' in rest && rest.href) {
      const { href, external, ...anchorRest } = rest as ButtonAsExternalLink;
      if (external) {
        return (
          <a
            ref={ref as React.Ref<HTMLAnchorElement>}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={classes}
            {...anchorRest}
          >
            {children}
          </a>
        );
      }
      return (
        <Link
          ref={ref as React.Ref<HTMLAnchorElement>}
          to={href}
          className={classes}
          {...(anchorRest as Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>)}
        >
          {children}
        </Link>
      );
    }

    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        className={classes}
        {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}
      >
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';
