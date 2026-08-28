-- ---------------------------------------------------------------------------
-- Convert the About page from hardcoded prose (previously baked directly
-- into src/pages/AboutPage.tsx) into real, admin-editable content in the
-- `pages` table, and mark it (and any future page like it) as a "system"
-- page: editable, but not deletable and not re-sluggable, since /about is
-- a fixed route in src/router.tsx (see RESERVED_PAGE_SLUGS in
-- lib/schemas.ts) and other parts of the site may link to it directly.
--
-- The seeded content below is the *exact* existing copy from
-- AboutPage.tsx converted to HTML, so this migration changes nothing
-- about what a visitor sees -- it only moves that text from a
-- compiled-in component into the database, which is what makes it
-- admin-editable going forward. No existing data is reset; this INSERT
-- only adds a new row.
-- ---------------------------------------------------------------------------

ALTER TABLE pages ADD COLUMN is_system INTEGER NOT NULL DEFAULT 0;

INSERT INTO pages (id, slug, title, content_html, status, seo_title, seo_description, is_system, created_by)
VALUES (
  'page_about_system',
  'about',
  'Comfort, designed around real UK weeks',
  '<p>Icebrim started with a simple frustration: cooling caps that slipped, warmed up too fast, or felt painfully cold the moment they left the freezer. We set out to build one that actually fits, actually stays cold, and actually gets reached for on a bad day &mdash; not left in a drawer after the first try.</p><p>Every design decision starts with the moment someone reaches for relief &mdash; usually mid-migraine, mid-hot-flush, at the worst possible time to fight with an ill-fitting product. That''s why fit, cold retention, and comfort come before anything else.</p><p>We''re a small UK-based team, and our products are designed to be a genuine part of your self-care routine, not a novelty that gets used once and forgotten.</p>',
  'published',
  'About Icebrim — Comfort Designed for Real UK Weeks',
  'Icebrim makes reusable cooling relief caps for migraines and menopause hot flushes. Learn why we started and how our caps are designed.',
  1,
  NULL
);
