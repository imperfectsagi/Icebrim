import { Hono } from 'hono';
import type { Env } from '../lib/env';

/**
 * Generates sitemap.xml dynamically from published products and blog
 * posts, plus the static pages. Mounted at /sitemap.xml in index.ts.
 * Regenerating on each request (with a cache header) keeps it always
 * accurate without needing a build step or admin action to refresh it.
 */
export const sitemap = new Hono<{ Bindings: Env }>();

const STATIC_PATHS = [
  '', 'about', 'products', 'blog', 'gallery', 'contact',
  'privacy-policy', 'terms', 'cookie-policy',
];

sitemap.get('/sitemap.xml', async (c) => {
  const siteUrl = c.env.PUBLIC_SITE_URL;

  const [{ results: products }, { results: posts }] = await Promise.all([
    c.env.DB.prepare('SELECT slug, updated_at FROM products WHERE published = 1').all<{ slug: string; updated_at: string }>(),
    c.env.DB.prepare(`SELECT slug, updated_at FROM blog_posts WHERE status = 'published'`).all<{ slug: string; updated_at: string }>(),
  ]);

  const urls: { loc: string; lastmod?: string }[] = [
    ...STATIC_PATHS.map((path) => ({ loc: `${siteUrl}/${path}` })),
    ...products.map((p) => ({ loc: `${siteUrl}/products/${p.slug}`, lastmod: p.updated_at })),
    ...posts.map((p) => ({ loc: `${siteUrl}/blog/${p.slug}`, lastmod: p.updated_at })),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${escapeXml(u.loc)}</loc>${u.lastmod ? `\n    <lastmod>${new Date(u.lastmod).toISOString().slice(0, 10)}</lastmod>` : ''}
  </url>`,
  )
  .join('\n')}
</urlset>`;

  c.header('Content-Type', 'application/xml');
  c.header('Cache-Control', 'public, max-age=3600');
  return c.body(xml);
});

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
