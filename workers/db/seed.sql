-- Seed data for local development / first deploy.
-- Run with: npx wrangler d1 execute icebrim-db --file=db/seed.sql --local
-- (drop --local to run against the remote/production database)
--
-- IMPORTANT: This does NOT include a working admin password. Create your
-- first admin user via the bootstrap script instead (see README.md,
-- "First-time setup"), which hashes a password you choose using the same
-- PBKDF2 implementation the Worker verifies against. A placeholder here
-- would either be a real credential committed to source control, or a
-- non-functional hash that silently fails to authenticate -- neither is
-- acceptable, so user creation is deliberately left to that script.

-- ---------------------------------------------------------------------------
-- Categories
-- ---------------------------------------------------------------------------
INSERT INTO categories (id, name, slug) VALUES
  ('cat_cooling_caps', 'Cooling Caps', 'cooling-caps');

-- ---------------------------------------------------------------------------
-- Products
-- ---------------------------------------------------------------------------
INSERT INTO products (
  id, slug, name, category, sku, price, offer_price, currency, stock,
  short_description, description, specs, seo_title, seo_description,
  published, rating_average, rating_count
) VALUES (
  'prod_cooling_relief_cap',
  'cooling-relief-cap',
  'Icebrim Cooling Relief Cap',
  'Cooling Caps',
  'ICB-CAP-001',
  44.99,
  34.99,
  'GBP',
  128,
  'A 360° cooling gel cap designed for soothing comfort during migraines, tension headaches, and menopausal hot flushes — reusable, drug-free, and fitted to contour gently around the eyes and nose.',
  'The Icebrim Cooling Relief Cap is built to fix what other cooling caps get wrong. A flexible gel core stays soft and comfortably cold straight from the freezer, so there is no painful cold shock. The contoured nose bridge and full 360° coverage keep it in place whether you are lying down or moving around the house, and dense, light-absorbing fabric across the eyes helps with brightness sensitivity during a migraine.',
  '[{"label":"Coverage","value":"360° full head, contoured nose bridge"},{"label":"Core material","value":"Flexible cooling gel"},{"label":"Use cases","value":"Migraines, tension headaches, hot flushes"},{"label":"Reusable","value":"Yes — refreeze and reuse"},{"label":"Lifespan","value":"Up to 5 years with proper storage"}]',
  'Icebrim Cooling Relief Cap | Drug-Free Migraine & Hot Flush Relief',
  'A 360° cooling gel cap for migraines, tension headaches, and menopausal hot flushes. Reusable, drug-free, shaped to actually fit.',
  1,
  4.8,
  4
);

INSERT INTO product_images (id, product_id, src, alt, sort_order) VALUES
  ('img_crc_1', 'prod_cooling_relief_cap', '/assets/products/cooling-relief-cap/hero-lifestyle.jpg', 'Icebrim Cooling Relief Cap, teal cooling gel head cap with contoured eye area', 0);

-- ---------------------------------------------------------------------------
-- Site content: home page + company settings
-- (JSON matches the frontend's HomePageContent / CompanySettings types --
-- see src/data/home.ts and src/data/company.ts for the reference shape,
-- which this seed mirrors so the live API returns identical content to
-- the frontend's local-dev fallback data.)
-- ---------------------------------------------------------------------------
INSERT INTO site_content (key, value) VALUES (
  'company',
  '{"name":"Icebrim","legalName":"Icebrim Ltd","aboutShort":"Reusable cooling comfort caps for migraines, tension headaches, and menopause hot flushes.","address":"Registered in England and Wales","phone":"+44 20 0000 0000","whatsapp":"+44 7000 000000","email":"hello@icebrim.com","googleMapsEmbedUrl":"","social":{"instagram":"https://instagram.com/icebrim","facebook":"https://facebook.com/icebrim","tiktok":"https://tiktok.com/@icebrim"},"footerNote":"Icebrim products are comfort and self-care accessories and are not intended to diagnose, treat, cure, or prevent any medical condition.","copyright":"© {year} Icebrim Ltd. All rights reserved.","businessHours":[{"day":"Monday – Friday","hours":"9:00 AM – 5:30 PM"},{"day":"Saturday","hours":"10:00 AM – 2:00 PM"},{"day":"Sunday","hours":"Closed"}],"logo":{"src":"/assets/brand/logo.png","alt":"Icebrim"}}'
);
