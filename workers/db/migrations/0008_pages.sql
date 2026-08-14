-- ---------------------------------------------------------------------------
-- Generic CMS Page Management.
--
-- Distinct from the existing `site_content` policy-page rows (see
-- 0001_initial_schema.sql / routes/admin-content.ts) -- those are a fixed
-- set of exactly three routes the frontend already knows about
-- (PrivacyPolicyPage / CookiePolicyPage / TermsPage) and were deliberately
-- kept out of a generic slug system (see the comment above POLICY_KEYS in
-- admin-content.ts). Page Management is the open-ended version: an admin
-- can add any number of pages, each with its own admin-chosen slug, and
-- the public site resolves them at runtime via a single `/pages/:slug`
-- catch-some route (see src/pages/CustomPage.tsx) rather than needing a
-- fixed route added per page. Same table shape/conventions as
-- `blog_posts` (slug + title + content_html + status) since that's the
-- closest existing pattern for "admin writes rich text, public site reads
-- by slug" -- see routes/blog.ts as the direct template routes/pages.ts
-- follows.
-- ---------------------------------------------------------------------------

CREATE TABLE pages (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content_html TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  seo_title TEXT NOT NULL DEFAULT '',
  seo_description TEXT NOT NULL DEFAULT '',
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_pages_slug ON pages(slug);
CREATE INDEX idx_pages_status ON pages(status);
