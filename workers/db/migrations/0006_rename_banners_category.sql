-- ---------------------------------------------------------------------------
-- Rename the 'banners' media category to 'hero-media'.
--
-- WHY: uploaded media URLs embed the category as an R2 key/path segment
-- (see workers/src/routes/media.ts), e.g.
--   https://<worker>/media/uploads/banners/<id>.webp
-- The literal substring "banners" is a well-known ad/tracker filter-list
-- keyword (EasyList and similar lists block request URLs containing
-- "banner"/"banners" outright). Browsers with tracker-blocking enabled by
-- default in private/incognito mode -- and any ad-blocker extension --
-- will silently block these requests client-side, which surfaces as
-- `net::ERR_BLOCKED` in DevTools. This has nothing to do with the server,
-- CORS, or auth; it's the browser refusing to even send the request
-- because of the URL's *text*, not its content. See DEPLOYMENT.md §9.
--
-- This migration only updates the `category` column and its CHECK
-- constraint (SQLite requires a table rebuild to change a CHECK
-- constraint, hence the copy/drop/rename below -- this is the standard
-- SQLite pattern for that, not a data-loss risk: every row and column is
-- preserved). It does NOT rewrite `r2_key`/`url`, and does NOT move or
-- rename the underlying R2 objects -- SQL migrations have no access to
-- R2. Existing already-uploaded 'banners' media keeps working (the R2
-- object doesn't move, so its old URL still resolves) but will still
-- contain "banners" in its path and therefore still get blocked in
-- Incognito until it's migrated to a non-blocked path.
--
-- Run `node scripts/repair-media-urls.ts --rename-banners` (see that
-- script's header) AFTER this migration to actually move the R2 objects
-- to `uploads/hero-media/...` keys and update every row/reference that
-- points at them (media.url, media.r2_key, and any product/blog/gallery/
-- site_content field that copied one of those URLs at save time). Doing
-- the R2 move is optional but recommended -- without it, existing hero
-- banners remain blocked in Incognito even though *new* uploads (which
-- will use the 'hero-media' category from here on) are fine.
-- ---------------------------------------------------------------------------

PRAGMA foreign_keys = OFF;

CREATE TABLE media_new (
  id TEXT PRIMARY KEY,
  r2_key TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  media_type TEXT NOT NULL DEFAULT 'image' CHECK (media_type IN ('image', 'video', 'gif')),
  duration_seconds REAL,
  category TEXT NOT NULL DEFAULT 'other'
    CHECK (category IN ('products', 'hero-media', 'blog', 'company', 'gallery', 'other'))
);

INSERT INTO media_new
SELECT
  id, r2_key, url, filename, content_type, size_bytes, width, height,
  uploaded_by, created_at, media_type, duration_seconds,
  CASE WHEN category = 'banners' THEN 'hero-media' ELSE category END
FROM media;

DROP TABLE media;
ALTER TABLE media_new RENAME TO media;

CREATE INDEX idx_media_category ON media(category);

PRAGMA foreign_keys = ON;
