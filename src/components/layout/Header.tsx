import { useState, useEffect } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, X, ShoppingBag } from 'lucide-react';
import { Container } from '@/components/ui/primitives';
import { Button } from '@/components/ui/Button';
import { useCompanySettings } from '@/hooks/useContent';
import { useCart } from '@/features/cart/CartContext';
import { cn } from '@/lib/utils';

const NAV_LINKS = [
  { label: 'Home', href: '/' },
  { label: 'About', href: '/about' },
  { label: 'Products', href: '/products' },
  { label: 'Blog', href: '/blog' },
  { label: 'Gallery', href: '/gallery' },
  { label: 'Contact', href: '/contact' },
];

export function Header() {
  const { data: company } = useCompanySettings();
  const { itemCount, openCart } = useCart();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    // Close mobile menu on route change (Escape key also closes it)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <header
      className={cn(
        'sticky top-0 z-50 bg-white/90 backdrop-blur-md transition-shadow duration-200',
        scrolled && 'shadow-[0_1px_0_0_var(--color-line)]',
      )}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[60] focus:bg-white focus:px-4 focus:py-2 focus:rounded-md"
      >
        Skip to main content
      </a>
      <Container className="flex items-center justify-between h-20">
        <Link to="/" className="flex items-center gap-2 shrink-0" aria-label={company?.name ?? 'Icebrim'}>
          {company?.logo?.src ? (
            // Header logo is part of the persistent nav shown on every
            // page load -- load it eagerly so it doesn't pop in.
            <img src={company.logo.src} alt={company.logo.alt} loading="eager" className="h-8 w-auto" />
          ) : (
            <span className="font-display text-2xl font-semibold">Icebrim</span>
          )}
        </Link>

        <nav className="hidden md:flex items-center gap-8" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.href}
              to={link.href}
              className={({ isActive }) =>
                cn(
                  'text-sm font-medium text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] transition-colors',
                  isActive && 'text-[var(--color-ink)]',
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden md:block">
          <Button href="/products" size="sm">
            Shop Now
          </Button>
        </div>

        <button
          type="button"
          onClick={openCart}
          className="relative inline-flex items-center justify-center h-10 w-10 rounded-full hover:bg-[var(--color-surface-alt)]"
          aria-label={itemCount > 0 ? `Open cart, ${itemCount} item${itemCount === 1 ? '' : 's'}` : 'Open cart'}
        >
          <ShoppingBag size={20} aria-hidden="true" />
          {itemCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-[var(--color-coral)] text-white text-[10px] font-bold flex items-center justify-center"
              aria-hidden="true"
            >
              {itemCount > 99 ? '99+' : itemCount}
            </span>
          )}
        </button>

        <button
          type="button"
          className="md:hidden inline-flex items-center justify-center h-10 w-10 rounded-full hover:bg-[var(--color-surface-alt)]"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </Container>

      {open && (
        <div className="md:hidden border-t border-[var(--color-line)] bg-white">
          <Container className="py-4 flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.href}
                to={link.href}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'mobile-nav-link px-2 py-3 rounded-lg text-base font-medium hover:bg-[var(--color-surface-alt)]',
                    isActive && 'mobile-nav-link-active bg-[var(--color-surface-alt)]',
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
            <Button href="/products" className="mt-2 w-full">
              Shop Now
            </Button>
          </Container>
        </div>
      )}
    </header>
  );
}
