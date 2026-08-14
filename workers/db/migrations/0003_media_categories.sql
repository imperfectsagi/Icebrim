-- ---------------------------------------------------------------------------
-- Introduce a real folder/category structure for uploaded media.
--
-- Previously every upload landed in a single flat `uploads/` R2 prefix
-- regardless of context (product photo, banner, blog image, company/logo
-- asset, gallery content). This adds a fixed-set `category` column to the
-- media table so new uploads are organized both in storage (R2 key prefix,
-- see workers/src/routes/media.ts) and in the admin media browser.
--
-- Existing rows default to 'other' -- their R2 keys are NOT rewritten (the
-- already-stored URLs keep working exactly as before), they simply won't
-- have a specific category until re-uploaded or backfilled by hand.
-- ---------------------------------------------------------------------------

ALTER TABLE media ADD COLUMN category TEXT NOT NULL DEFAULT 'other'
  CHECK (category IN ('products', 'banners', 'blog', 'company', 'gallery', 'other'));

CREATE INDEX idx_media_category ON media(category);
