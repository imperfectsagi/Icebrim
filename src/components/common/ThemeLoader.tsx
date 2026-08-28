import { useEffect } from 'react';
import { useThemeSettings, useCompanySettings } from '@/hooks/useContent';
import { deriveShades } from '@/lib/color';

const SITE_URL = (import.meta.env.VITE_SITE_URL ?? 'https://icebrim.com').replace(/\/+$/, '');

// Same localStorage key the inline pre-hydration script in index.html
// reads synchronously before first paint. Keep these two in sync -- see
// the comment in index.html for the full flash-fix explanation.
const ACCENT_COLOR_CACHE_KEY = 'icebrim-accent-color';

/**
 * Applies site-wide settings that must be read from the CMS at runtime
 * (rather than baked into index.html at build time) to the document:
 *
 * 1. Brand accent color, from Admin > Branding -- see below.
 * 2. Favicon, from Admin > Company Settings -- see below.
 * 3. Site-wide Organization JSON-LD structured data -- see below.
 *
 * Renders nothing. Mounted once near the root in App.tsx.
 */
export function ThemeLoader() {
  const { data: theme } = useThemeSettings();
  const { data: company } = useCompanySettings();

  // Brand accent color: every "orange" button, active nav link, focus
  // ring, and coral-tinted surface in the app reads from --color-coral /
  // --color-coral-deep / --color-coral-tint (see src/index.css), so
  // overriding those three variables here re-colors the whole site --
  // public pages and admin panel alike -- from one saved value, with no
  // per-component changes required.
  //
  // Also caches the resolved color to localStorage. This is what lets
  // index.html's inline pre-hydration script apply the *previously
  // known* color synchronously on the very next page load, before this
  // effect (or even React) has run -- see index.html for the full
  // writeup of the flash this fixes. Without this cache write, the
  // flash would return on every load because there would be nothing for
  // that script to read.
  useEffect(() => {
    if (!theme?.accentColor) return;
    const root = document.documentElement;
    const { base, deep, tint } = deriveShades(theme.accentColor);
    root.style.setProperty('--color-coral', base);
    root.style.setProperty('--color-coral-deep', deep);
    root.style.setProperty('--color-coral-tint', tint);
    try {
      localStorage.setItem(ACCENT_COLOR_CACHE_KEY, theme.accentColor);
    } catch {
      // localStorage unavailable (private mode, storage full, etc.) --
      // the color is still applied correctly for this page view via the
      // setProperty calls above, it just won't be cached for next time.
    }
  }, [theme?.accentColor]);

  // Favicon: index.html ships a static fallback <link rel="icon"> so the
  // tab icon isn't blank before this runs or if the CMS request fails, but
  // once company settings load we point it at the admin-chosen favicon
  // (falling back to the logo if no dedicated favicon was set -- see
  // FIX-027). Without this, uploading a new logo/favicon in the admin
  // panel had no visible effect: the favicon was frozen at build time.
  useEffect(() => {
    const src = company?.logoIcon?.src || company?.logo?.src;
    if (!src) return;
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = src;
  }, [company?.logoIcon?.src, company?.logo?.src]);

  // Site-wide Organization structured data (FIX-030). This is separate
  // from the per-page JSON-LD that SeoHead.tsx manages (id="json-ld",
  // e.g. Product/BlogPosting schema) -- both are meant to coexist on the
  // same page, one describing the specific page's content, the other
  // describing the business itself, which is why this uses its own
  // script id rather than sharing SeoHead's.
  useEffect(() => {
    if (!company) return;
    let script = document.getElementById('json-ld-organization') as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = 'json-ld-organization';
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: company.name,
      legalName: company.legalName,
      url: SITE_URL,
      logo: company.logo.src,
      description: company.aboutShort,
      contactPoint: {
        '@type': 'ContactPoint',
        telephone: company.phone,
        email: company.email,
        contactType: 'customer service',
      },
      ...(company.social && {
        sameAs: [company.social.instagram, company.social.facebook, company.social.tiktok, company.social.twitter].filter(
          Boolean,
        ),
      }),
    });
  }, [company]);

  return null;
}
