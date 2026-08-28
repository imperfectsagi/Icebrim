-- ---------------------------------------------------------------------------
-- Fix: allow 'reviews' as a media category.
--
-- BUG: migration 0010_review_multi_image.sql (and the accompanying code in
-- workers/src/routes/media.ts) added a public review-media upload path
-- that inserts into `media` with category = 'reviews'. The TypeScript-level
-- MEDIA_CATEGORIES allowlist in media.ts was updated to include 'reviews',
-- but the *database's* CHECK constraint on media.category (defined in
-- migration 0006_rename_banners_category.sql) was never updated to match.
-- Every review-media upload therefore failed at the final INSERT with
-- `CHECK constraint failed: category IN (...)`, surfacing to the buyer as
-- a generic "Internal server error" / failed upload -- confirmed by
-- reproducing the 500 locally against `wrangler dev` before writing this
-- fix. This is the actual root cause of the reported "review image/video
-- upload doesn't work" bug; the upload UI, request plumbing, R2 write,
-- and public rendering code were all otherwise correct.
--
-- Same copy/drop/rename rebuild pattern as 0006_rename_banners_category.sql
-- (SQLite requires a full table rebuild to change a CHECK constraint --
-- there's no ALTER TABLE ... DROP/ADD CONSTRAINT). Every row/column is
-- preserved as-is; only the constraint's allowed value list changes.
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
    CHECK (category IN ('products', 'hero-media', 'blog', 'company', 'gallery', 'reviews', 'other'))
);

INSERT INTO media_new SELECT * FROM media;

DROP TABLE media;
ALTER TABLE media_new RENAME TO media;

CREATE INDEX idx_media_category ON media(category);

PRAGMA foreign_keys = ON;
