import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Package, FolderTree, FileText, Star, Image,
  PanelTop, Settings, Users, Search, Mail, BarChart3, Cog, LogOut, Palette,
  Images as GalleryIcon, ShoppingBag, Menu, X, ScrollText, Tag, Files, Megaphone,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useCompanySettings } from '@/hooks/useContent';
import { cn } from '@/lib/utils';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface NavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
}

const NAV_SECTIONS: { title?: string; items: NavItem[] }[] = [
  {
    items: [{ label: 'Dashboard', href: '/admin', icon: LayoutDashboard, end: true }],
  },
  {
    title: 'Content',
    items: [
      { label: 'Products', href: '/admin/products', icon: Package },
      { label: 'Categories', href: '/admin/categories', icon: FolderTree },
      { label: 'Blogs', href: '/admin/blogs', icon: FileText },
      { label: 'Pages', href: '/admin/pages', icon: Files },
      { label: 'Reviews', href: '/admin/reviews', icon: Star },
      { label: 'Media Library', href: '/admin/media', icon: Image },
      { label: 'Gallery', href: '/admin/gallery', icon: GalleryIcon },
      { label: 'Banner', href: '/admin/banner', icon: PanelTop },
      { label: 'Policy Pages', href: '/admin/policies', icon: ScrollText },
    ],
  },
  {
    title: 'Sales',
    items: [
      { label: 'Orders', href: '/admin/orders', icon: ShoppingBag },
      { label: 'Coupons', href: '/admin/coupons', icon: Tag },
    ],
  },
  {
    title: 'Site',
    items: [
      { label: 'Company Settings', href: '/admin/settings/company', icon: Settings },
      { label: 'Branding', href: '/admin/settings/branding', icon: Palette },
      { label: 'Promo Banner', href: '/admin/settings/promo-banner', icon: Megaphone },
      { label: 'SEO Settings', href: '/admin/settings/seo', icon: Search },
      { label: 'Contact Messages', href: '/admin/messages', icon: Mail },
      { label: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
    ],
  },
  {
    title: 'Administration',
    items: [
      { label: 'Users', href: '/admin/users', icon: Users },
      { label: 'System Settings', href: '/admin/settings/system', icon: Cog },
    ],
  },
];

export function AdminLayout() {
  const { user, logout } = useAuth();
  const { data: company } = useCompanySettings();
  const navigate = useNavigate();
  const location = useLocation();
  const [loggingOut, setLoggingOut] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // Close the mobile drawer automatically on route change, mirroring the
  // pattern already used by the public Header's mobile menu.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Focus management (FIX-031): move focus into the drawer on open, trap
  // Tab/Shift+Tab within it, and restore focus to the hamburger button
  // that opened it on close -- same treatment as CartDrawer.tsx and
  // AdminModal.tsx for consistency across the app's overlay panels.
  useEffect(() => {
    if (mobileOpen) {
      previouslyFocused.current = document.activeElement as HTMLElement | null;
      drawerRef.current?.focus();
    } else if (previouslyFocused.current) {
      previouslyFocused.current.focus();
    }
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileOpen(false);
        return;
      }
      if (e.key !== 'Tab' || !drawerRef.current) return;
      const focusable = Array.from(drawerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
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
  }, [mobileOpen]);

  const handleLogout = async () => {
    if (loggingOut) return; // guard against double-clicks firing two logout calls
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      // Navigate explicitly rather than relying solely on RequireAuth's
      // state-driven redirect -- that redirect still works as a backstop,
      // but an explicit navigate() here means sign-out feels immediate
      // instead of waiting on a re-render to notice the state change.
      navigate('/admin/login', { replace: true });
    }
  };

  const sidebarContent = (
    <>
      <div className="h-16 flex items-center px-5 border-b border-[var(--color-line)] shrink-0">
        {company?.logo?.src ? (
          <img src={company.logo.src} alt={company.logo.alt} loading="eager" className="h-6 w-auto" />
        ) : (
          <span className="font-display text-lg font-semibold">Icebrim</span>
        )}
        <span className="ml-2 text-xs font-semibold text-[var(--color-ink-soft)] uppercase tracking-wide">
          Admin
        </span>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="ml-auto md:hidden inline-flex items-center justify-center h-9 w-9 rounded-full hover:bg-[var(--color-surface-alt)]"
          aria-label="Close menu"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        {NAV_SECTIONS.map((section, i) => (
          <div key={i}>
            {section.title && (
              <p className="px-3 mb-2 text-xs font-semibold text-[var(--color-ink-soft)] uppercase tracking-wide">
                {section.title}
              </p>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.href}>
                  <NavLink
                    to={item.href}
                    end={item.end}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-[var(--color-ink-soft)] hover:bg-[var(--color-surface-alt)] transition-colors',
                        isActive && 'bg-[var(--color-coral-tint)] text-[var(--color-coral-deep)]',
                      )
                    }
                  >
                    <item.icon size={16} aria-hidden="true" />
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-[var(--color-line)] p-4 shrink-0">
        <p className="text-sm font-medium truncate">{user?.username}</p>
        <p className="text-xs text-[var(--color-ink-soft)] truncate mb-3">{user?.email}</p>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex items-center gap-2 text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-coral-deep)] disabled:opacity-60"
        >
          <LogOut size={15} aria-hidden="true" />
          {loggingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex bg-[var(--color-surface)]">
      {/* Mobile top bar with hamburger toggle -- hidden at md and above where the
          sidebar is always visible. */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 h-14 flex items-center justify-between px-4 bg-white border-b border-[var(--color-line)]">
        <div className="flex items-center gap-2">
          {company?.logo?.src ? (
            <img src={company.logo.src} alt={company.logo.alt} loading="eager" className="h-5 w-auto" />
          ) : (
            <span className="font-display text-base font-semibold">Icebrim</span>
          )}
          <span className="text-xs font-semibold text-[var(--color-ink-soft)] uppercase tracking-wide">
            Admin
          </span>
        </div>
        <button
          ref={menuButtonRef}
          type="button"
          onClick={() => setMobileOpen(true)}
          className="inline-flex items-center justify-center h-10 w-10 rounded-full hover:bg-[var(--color-surface-alt)]"
          aria-label="Open menu"
          aria-expanded={mobileOpen}
        >
          <Menu size={22} aria-hidden="true" />
        </button>
      </div>

      {/* Desktop sidebar -- always visible at md and above, unchanged behavior. */}
      <aside className="hidden md:flex w-64 shrink-0 bg-white border-r border-[var(--color-line)] flex-col">
        {sidebarContent}
      </aside>

      {/* Mobile drawer -- overlay + slide-in panel, only rendered/interactive below md. */}
      <div
        className={cn(
          'md:hidden fixed inset-0 z-50 transition-opacity duration-200',
          mobileOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
        )}
        aria-hidden={!mobileOpen}
      >
        <button
          type="button"
          className="absolute inset-0 bg-black/40"
          aria-label="Close menu"
          tabIndex={mobileOpen ? 0 : -1}
          onClick={() => setMobileOpen(false)}
        />
        <aside
          ref={drawerRef}
          role="dialog"
          aria-modal="true"
          aria-label="Admin navigation"
          tabIndex={-1}
          className={cn(
            'absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white flex flex-col shadow-[var(--shadow-lift)] transition-transform duration-200 focus:outline-none',
            mobileOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          {sidebarContent}
        </aside>
      </div>

      <div className="flex-1 min-w-0">
        <main className="p-4 pt-20 md:p-10 md:pt-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
