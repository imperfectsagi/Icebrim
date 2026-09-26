-- ---------------------------------------------------------------------------
-- Customer offer popup: email capture.
--
-- The popup's own configuration (enabled/disabled, heading, subheading,
-- which existing coupon it shows) does NOT need a new table -- it's a
-- single JSON document, exactly like promo_banner / delivery_info /
-- theme, so it's stored as one more row in the existing `site_content`
-- table (key = 'popup_offer', see routes/admin-content.ts). No schema
-- change is needed for that part.
--
-- What DOES need a new table is the list of emails the popup collects --
-- that's multiple rows accumulating over time, not a single settings
-- document, so it doesn't fit the site_content key/value shape. This
-- follows the exact same shape as the existing newsletter_subscribers /
-- contact_messages tables from migration 0001 (id, email, timestamp),
-- with one addition: the coupon code that was shown to that customer at
-- signup, captured as a point-in-time snapshot (coupon_code TEXT, not a
-- foreign key to coupons.id) so this row keeps displaying correctly in
-- the admin panel even after the admin later changes which coupon the
-- popup shows, or deletes that coupon entirely -- same "snapshot,
-- don't hard-reference" reasoning already used for orders.coupon_code
-- in migration 0007_coupons.sql.
-- ---------------------------------------------------------------------------

CREATE TABLE popup_offer_emails (
  id TEXT PRIMARY KEY,               -- e.g. "pop_<uuid>"
  email TEXT NOT NULL,
  coupon_code TEXT,                  -- snapshot of the coupon code shown at signup time; NULL if no coupon was configured when this email was captured
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_popup_offer_emails_created ON popup_offer_emails(created_at);

-- No UNIQUE constraint on email: unlike newsletter_subscribers (one
-- active subscription per address), the popup is a point-in-time offer
-- capture -- the same visitor may legitimately submit again for a later
-- festival/promo offer, and the admin's "submission date/time" list
-- (requirement #2) is meant to show every submission, not just the
-- latest per address.
