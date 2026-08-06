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
  ADMIN_SETUP_TOKEN: string;
}

/** Minimal shape of Cloudflare's Rate Limiting binding. */
export interface RateLimit {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}
