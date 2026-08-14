export interface Env {
  DB: D1Database;
  MEDIA_BUCKET: R2Bucket;
  IMAGES: ImagesBinding;
  LOGIN_RATE_LIMITER: RateLimit;
  FORM_RATE_LIMITER: RateLimit;

  // Vars
  // PUBLIC_SITE_URL: comma-separated list of allowed frontend origins, e.g.
  // "https://icebrim.pages.dev,https://icebrim.com,https://www.icebrim.com"
  // Every origin the admin panel or public site is served from MUST be
  // listed here, or the browser's CORS check will block API requests
  // (including login) from that origin. See lib/cors.ts.
  PUBLIC_SITE_URL: string;
  ENVIRONMENT: string;
  // This Worker's own public base URL, e.g. "https://icebrim-api.example.workers.dev".
  // Used to build absolute URLs for uploaded media. See wrangler.toml.
  WORKER_PUBLIC_URL: string;

  // Secrets (set via `wrangler secret put`)
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  TURNSTILE_SECRET_KEY: string;

  // E-commerce payment secrets (see lib/payments.ts, routes/webhooks.ts)
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  RAZORPAY_KEY_ID?: string;
  RAZORPAY_KEY_SECRET?: string;
  RAZORPAY_WEBHOOK_SECRET?: string;

  // Transactional email (order confirmations). See lib/email.ts.
  RESEND_API_KEY?: string;
}

/**
 * NOTE on admin bootstrapping: there is intentionally no HTTP-based "setup"
 * route gated on a shared secret. The first admin user is created via
 * `workers/scripts/create-admin.mjs` (run with direct D1 access), which is
 * a stronger security boundary than any bearer-token-over-HTTP approach
 * would be. Do not add an ADMIN_SETUP_TOKEN-style env var without a
 * corresponding route that enforces "only works when zero users exist."
 */

/** Minimal shape of Cloudflare's Rate Limiting binding. */
export interface RateLimit {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}
