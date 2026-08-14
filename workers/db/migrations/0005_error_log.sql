-- ---------------------------------------------------------------------------
-- Basic error visibility (FIX-034).
--
-- A dedicated table rather than reusing `audit_log`: audit_log is shaped
-- around admin actions (it assumes a user_id is the interesting subject),
-- while unhandled errors often have NO associated admin user at all --
-- an anonymous checkout failing, a payment webhook throwing, a public
-- content-fetch route erroring. Forcing those into audit_log's shape would
-- either require a fake user_id or weaken what audit_log means. This
-- table is deliberately minimal: enough to see what broke and how often,
-- not a full observability platform (see FIX-034's own scoping note in
-- the repair plan -- a lightweight D1 table was explicitly preferred over
-- integrating a third-party service for a project this size).
-- ---------------------------------------------------------------------------

CREATE TABLE error_log (
  id TEXT PRIMARY KEY,
  -- Coarse category so payment-related failures (the highest-value thing
  -- to notice quickly, per FIX-034 Step 2) can be queried/filtered
  -- separately from routine request errors without scanning everything.
  category TEXT NOT NULL DEFAULT 'general'
    CHECK (category IN ('general', 'payment', 'webhook', 'auth')),
  message TEXT NOT NULL,
  stack TEXT,
  method TEXT,
  path TEXT,
  status_code INTEGER,
  -- Free-form JSON for anything category-specific worth capturing (e.g.
  -- an order id for a payment error) without needing a schema migration
  -- every time a new error-producing code path wants to attach context.
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_error_log_category ON error_log(category);
CREATE INDEX idx_error_log_created ON error_log(created_at);
