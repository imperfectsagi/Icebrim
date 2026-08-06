-- Migration 0001: Initial schema
-- Run with: npx wrangler d1 migrations apply icebrim-db

-- ---------------------------------------------------------------------------
-- Users (admin accounts)
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,      -- PBKDF2-SHA256 PHC-style string; see lib/password.ts
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'editor')),
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,                -- ISO timestamp; NULL if not locked
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------------
-- Refresh tokens (for JWT refresh flow) — stored so they can be revoked
-- ---------------------------------------------------------------------------
CREATE TABLE refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,         -- SHA-256 hash of the token, never store raw
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  user_agent TEXT,
  ip_address TEXT
);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);

-- ---------------------------------------------------------------------------
-- Audit log (login attempts, admin actions)
-- ---------------------------------------------------------------------------
CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,             -- e.g. 'login_success', 'login_failed', 'product_created'
  ip_address TEXT,
  user_agent TEXT,
  metadata TEXT,                    -- JSON blob with action-specific details
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at);

-- ---------------------------------------------------------------------------
-- IP-level login lockouts (separate from per-account lockouts)
-- ---------------------------------------------------------------------------
CREATE TABLE ip_lockouts (
  ip_address TEXT PRIMARY KEY,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------------
-- Categories
-- ---------------------------------------------------------------------------
CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------------
-- Products
-- ---------------------------------------------------------------------------
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  sku TEXT NOT NULL UNIQUE,
  price REAL NOT NULL CHECK (price >= 0),
  offer_price REAL CHECK (offer_price IS NULL OR offer_price >= 0),
  currency TEXT NOT NULL DEFAULT 'GBP',
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  short_description TEXT NOT NULL,
  description TEXT NOT NULL,
  specs TEXT NOT NULL DEFAULT '[]',       -- JSON array of {label, value}
  seo_title TEXT NOT NULL,
  seo_description TEXT NOT NULL,
  published INTEGER NOT NULL DEFAULT 0,   -- boolean 0/1
  rating_average REAL NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_published ON products(published);

CREATE TABLE product_images (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  src TEXT NOT NULL,
  alt TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_product_images_product ON product_images(product_id);

-- ---------------------------------------------------------------------------
-- Blog posts
-- ---------------------------------------------------------------------------
CREATE TABLE blog_posts (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  content_html TEXT NOT NULL,
  featured_image_src TEXT NOT NULL,
  featured_image_alt TEXT NOT NULL,
  category TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',        -- JSON array of strings
  author TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  published_at TEXT NOT NULL,
  seo_title TEXT NOT NULL,
  seo_description TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX idx_blog_posts_status ON blog_posts(status);

-- ---------------------------------------------------------------------------
-- Reviews
-- ---------------------------------------------------------------------------
CREATE TABLE reviews (
  id TEXT PRIMARY KEY,
  product_slug TEXT NOT NULL,
  author_name TEXT NOT NULL,
  location TEXT,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  ip_address TEXT,                        -- retained briefly for spam/abuse review only
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_reviews_product ON reviews(product_slug);
CREATE INDEX idx_reviews_status ON reviews(status);

-- ---------------------------------------------------------------------------
-- Contact messages
-- ---------------------------------------------------------------------------
CREATE TABLE contact_messages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  read INTEGER NOT NULL DEFAULT 0,
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_contact_messages_read ON contact_messages(read);

-- ---------------------------------------------------------------------------
-- Newsletter subscribers
-- ---------------------------------------------------------------------------
CREATE TABLE newsletter_subscribers (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  subscribed_at TEXT NOT NULL DEFAULT (datetime('now')),
  unsubscribed_at TEXT
);

-- ---------------------------------------------------------------------------
-- Gallery images
-- ---------------------------------------------------------------------------
CREATE TABLE gallery_images (
  id TEXT PRIMARY KEY,
  src TEXT NOT NULL,
  alt TEXT NOT NULL,
  caption TEXT,
  category TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------------
-- Media library (all uploaded files, for the Media Library admin module)
-- ---------------------------------------------------------------------------
CREATE TABLE media (
  id TEXT PRIMARY KEY,
  r2_key TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------------
-- Site content (single-row JSON documents for CMS-editable page content)
-- Keyed by `key` so home page content, company settings, SEO settings, and
-- system settings can all share one simple table without a migration each
-- time a new editable section is added.
-- ---------------------------------------------------------------------------
CREATE TABLE site_content (
  key TEXT PRIMARY KEY,             -- 'home', 'company', 'seo_settings', 'system_settings'
  value TEXT NOT NULL,              -- JSON blob matching the corresponding TS type
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL
);

-- ---------------------------------------------------------------------------
-- Page view analytics (lightweight, privacy-respecting: no cookies, no IP
-- storage beyond a truncated/hashed form)
-- ---------------------------------------------------------------------------
CREATE TABLE page_views (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL,
  referrer_host TEXT,
  visitor_hash TEXT NOT NULL,        -- daily-rotating hash, not a persistent identifier
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_page_views_path ON page_views(path);
CREATE INDEX idx_page_views_created ON page_views(created_at);
