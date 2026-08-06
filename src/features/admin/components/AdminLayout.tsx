import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Package, FolderTree, FileText, Star, Image,
  PanelTop, Settings, Users, Search, Mail, BarChart3, Cog, LogOut, Palette,
  Images as GalleryIcon,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { cn } from '@/lib/utils';

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
      { label: 'Reviews', href: '/admin/reviews', icon: Star },
      { label: 'Media Library', href: '/admin/media', icon: Image },
      { label: 'Gallery', href: '/admin/gallery', icon: GalleryIcon },
      { label: 'Banner', href: '/admin/banner', icon: PanelTop },
    ],
  },
  {
    title: 'Site',
    items: [
      { label: 'Company Settings', href: '/admin/settings/company', icon: Settings },
      { label: 'Branding', href: '/admin/settings/branding', icon: Palette },
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
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

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

  return (
    <div className="min-h-screen flex bg-[var(--color-surface)]">
      <aside className="w-64 shrink-0 bg-white border-r border-[var(--color-line)] flex flex-col">
        <div className="h-16 flex items-center px-5 border-b border-[var(--color-line)]">
          <img src="/assets/brand/logo.png" alt="Icebrim" loading="eager" className="h-6 w-auto" />
          <span className="ml-2 text-xs font-semibold text-[var(--color-ink-soft)] uppercase tracking-wide">
            Admin
          </span>
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

        <div className="border-t border-[var(--color-line)] p-4">
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
      </aside>

      <div className="flex-1 min-w-0">
        <main className="p-6 md:p-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
