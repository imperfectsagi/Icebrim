import { useEffect } from 'react';
import type { SeoMeta } from '@/types/cms';

const SITE_URL = 'https://icebrim.com';

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setLink(rel: string, href: string) {
  let el = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

/**
 * Sets document title, meta description, canonical URL, Open Graph and
 * Twitter Card tags for the current page. Runs client-side; for full SEO
 * crawlability the Worker should also render these tags server-side on
 * initial HTML response (see /workers/src/ssr-meta.ts).
 */
export function SeoHead({ seo, jsonLd }: { seo: SeoMeta; jsonLd?: Record<string, unknown> }) {
  useEffect(() => {
    document.title = seo.title;
    setMeta('name', 'description', seo.description);

    const canonical = `${SITE_URL}${seo.canonicalPath ?? ''}`;
    setLink('canonical', canonical);

    setMeta('property', 'og:title', seo.title);
    setMeta('property', 'og:description', seo.description);
    setMeta('property', 'og:type', 'website');
    setMeta('property', 'og:url', canonical);
    if (seo.ogImage) setMeta('property', 'og:image', seo.ogImage);

    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', seo.title);
    setMeta('name', 'twitter:description', seo.description);
    if (seo.ogImage) setMeta('name', 'twitter:image', seo.ogImage);

    let ldScript = document.getElementById('json-ld') as HTMLScriptElement | null;
    if (jsonLd) {
      if (!ldScript) {
        ldScript = document.createElement('script');
        ldScript.id = 'json-ld';
        ldScript.type = 'application/ld+json';
        document.head.appendChild(ldScript);
      }
      ldScript.textContent = JSON.stringify(jsonLd);
    } else if (ldScript) {
      ldScript.remove();
    }
  }, [seo, jsonLd]);

  return null;
}
