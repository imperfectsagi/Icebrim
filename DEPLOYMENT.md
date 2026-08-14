# Icebrim — Deployment Guide

This project has two parts that deploy separately:

- **Frontend** (`/`) — a Vite/React app, deployed on **Cloudflare Pages**.
- **API** (`/workers`) — a Cloudflare Worker (Hono) with a **D1** database and an **R2** bucket for images, deployed with **Wrangler**.

They only work together if each one knows the other's real URL. Almost every "login doesn't work" / "images are broken" / "media isn't connected" problem traces back to one of the two domains below being wrong — so read this in order, don't skip steps.

---

## 0. What was fixed before this guide was written

Before this pass, three URLs were **hardcoded to placeholder domains** left over from scaffolding:

1. The Worker only accepted CORS requests from `https://icebrim.pages.dev`, hardcoded.
2. The frontend's API calls defaulted to `icebrim-api.brand-launch-studio.workers.dev` — not a domain you own.
3. Every uploaded image's saved URL was hardcoded to that same placeholder Worker domain.

All three now come from environment variables instead (see below), and the media-URL one additionally self-corrects to your Worker's real request origin as a safety net. You still need to set the variables correctly for your real domains — that's what this guide walks through.

Also fixed in this pass, unrelated to domains:
- Gallery images previously could only be **created or deleted** — editing (swapping the image, changing alt text/caption/category) and reordering didn't exist. Both now exist, with a new **Gallery** page in the admin sidebar.
- Reviews previously could only be approved/rejected/deleted — there was no way to **edit** a review's star rating, title, or body. That's now available from an "Edit" button on the Reviews page.
- **Banner, Gallery, Blog featured media, and Reviews now support video and GIF, not just static images** — see section 7 for size limits and compression guidance, since video isn't auto-compressed the way images are.
- Every image on the site now has an explicit lazy-loading setting: below-the-fold images (product cards, blog cards, thumbnails, footer) load lazily; the one hero/featured image on each page loads eagerly so the page doesn't feel slow to appear.
- Sign-out now shows a "Signing out…" state and navigates immediately instead of only relying on a state change to trigger the redirect.

---

## 1. Deploy the Worker (API) first

The frontend needs the Worker's real URL before it can work, so deploy the Worker first.

```bash
cd workers
npm install
```

### 1.1 Create the D1 database and R2 bucket (first time only)

If you're using the `database_id` / `bucket_name` already in `wrangler.toml`, these may already exist on your account — check the Cloudflare dashboard under **Workers & Pages → D1** and **R2** first. If they don't exist yet:

```bash
npx wrangler d1 create icebrim-db
# copy the printed database_id into wrangler.toml under [[d1_databases]]

npx wrangler r2 bucket create icebrim-media
```

### 1.2 Run database migrations

```bash
npx wrangler d1 migrations apply icebrim-db --remote
```

This applies all four migrations in `workers/db/migrations/`: `0001_initial_schema.sql` (the original schema), `0002_media_video_support.sql` (adds video/GIF support to the banner, blog, gallery, and reviews — see section 7 below), `0003_media_categories.sql` (organizes uploads into folders — Products/Banners/Blog/Company/Gallery/Other), and `0004_orders_schema.sql` (the e-commerce orders/checkout schema — see section 6 below). Wrangler tracks which migrations have already run, so it's always safe to re-run this command after pulling new changes — it only applies what's new.

(Use `--local` instead when testing with `wrangler dev` locally.)

### 1.3 Set secrets

These are never committed to git — set them directly on Cloudflare:

```bash
npx wrangler secret put JWT_ACCESS_SECRET
npx wrangler secret put JWT_REFRESH_SECRET
npx wrangler secret put TURNSTILE_SECRET_KEY
```

Generate strong random values for the two JWT secrets, e.g.:

```bash
openssl rand -base64 48
```

`TURNSTILE_SECRET_KEY` comes from your Cloudflare Turnstile widget (Dashboard → Turnstile). If you're not using Turnstile yet, you can put in a placeholder, but the contact form / review submission endpoints that check it will reject requests until it's a real key.

> The first admin user is bootstrapped via `workers/scripts/create-admin.mjs` (step 1.5 below), which writes directly to D1. There is no HTTP-based admin-setup endpoint or setup token in this codebase by design — a shared-secret-over-HTTP bootstrap route is a weaker security boundary than a script that requires direct D1/Wrangler access.

### 1.4 Deploy

```bash
npx wrangler deploy
```

Wrangler prints your Worker's live URL, something like:

```
https://icebrim-api.<your-account-subdomain>.workers.dev
```

**Copy this exact URL — you'll need it twice below.**

### 1.5 Set `WORKER_PUBLIC_URL` to that real URL

Open `workers/wrangler.toml` and replace the placeholder:

```toml
WORKER_PUBLIC_URL = "https://icebrim-api.YOUR-SUBDOMAIN.workers.dev"
```

with the URL you copied in 1.4. Then redeploy:

```bash
npx wrangler deploy
```

This is what makes uploaded images (products, blog, gallery, logo) resolve correctly instead of pointing at a domain you don't own. If you skip this step, uploads will still *technically* work because the code falls back to the request's own origin — but setting it explicitly is the reliable, intended path, especially once you're behind a custom domain or any kind of proxy.

### 1.6 Create your first admin user

```bash
node scripts/create-admin.mjs your-username you@example.com "a-strong-password-12+chars" 
```

Run without `--local` to target the production database (or add `--local` for local dev). This prints a `wrangler d1 execute` command — run the command it prints to actually insert the user.

---

## 2. Deploy the frontend (Cloudflare Pages)

### 2.1 Set the API URL Pages will build with

`.env.production` is **not committed to git** (see `.gitignore`) — the Cloudflare Pages dashboard environment variables are the single source of truth for production config. If you keep a local `.env.production` file for your own convenience, it never leaves your machine and is not read by the actual Pages build.

**Pages dashboard → your project → Settings → Environment variables → Production:**

| Variable | Value |
|---|---|
| `VITE_API_BASE_URL` | the exact Worker URL from step 1.4, e.g. `https://icebrim-api.your-subdomain.workers.dev` — **no trailing slash** |
| `VITE_SITE_URL` | the exact frontend URL this deployment is served from, e.g. `https://icebrim.com` — used for canonical/SEO tags (see `src/components/common/SeoHead.tsx`) |

If you also use a Pages **Preview** environment (e.g. for pull requests), set the same variables there too (with the preview domain for `VITE_SITE_URL`), or preview deploys will silently fall back to local seed data / production canonical URLs instead of their own.

### 2.2 Connect this repo and deploy

If you're deploying via git auto-deploy (as you mentioned), Cloudflare Pages build settings should be:

- **Build command:** `npm run build`
- **Build output directory:** `dist`
- **Root directory:** set this to wherever `package.json` for the frontend lives in your repo (the one with the `vite build` script — not the `workers/` folder).

Push to your connected branch; Pages will build and deploy automatically. Confirm the deployed URL matches what you expect (your `*.pages.dev` URL, shown in the Pages dashboard).

---

## 3. Tell the Worker which frontend origins are allowed (the CORS step)

This is the step that fixes **login failing** and any "network error" you see only on the live site but not locally.

Open `workers/wrangler.toml` and set `PUBLIC_SITE_URL` to a **comma-separated list of every origin your frontend is actually served from**:

```toml
[vars]
PUBLIC_SITE_URL = "https://icebrim.pages.dev,https://icebrim.com,https://www.icebrim.com"
```

- Always include your `*.pages.dev` URL, even after connecting a custom domain — Cloudflare keeps it live alongside the custom domain.
- Include **both** the bare domain and the `www.` version if you plan to use either — they're different origins as far as CORS is concerned.
- No trailing slashes.
- After editing, redeploy the Worker: `npx wrangler deploy`.

If you connect a custom domain to Pages *after* first deploying, come back and re-run this step with the new domain added — that's the #1 way this breaks again later.

---

## 4. Connecting your custom domain (once everything above works on `*.pages.dev`)

1. **Cloudflare Pages → your project → Custom domains → Set up a custom domain.** Follow the DNS instructions Cloudflare gives you.
2. Once the custom domain is active, add it to `PUBLIC_SITE_URL` in `workers/wrangler.toml` (step 3) and redeploy the Worker.
3. If you want the Worker itself on a custom domain/subdomain too (e.g. `api.icebrim.com` instead of the `workers.dev` URL), set that up under **Workers & Pages → icebrim-api → Settings → Domains & Routes**, then update both `WORKER_PUBLIC_URL` (step 1.5) and the Pages `VITE_API_BASE_URL` (step 2.1) to match, and redeploy both.

**Order matters:** domain changes only take effect after redeploying the Worker (for `PUBLIC_SITE_URL`/`WORKER_PUBLIC_URL`) and rebuilding Pages (for `VITE_API_BASE_URL`). Changing a dashboard variable alone does not update an already-built deployment.

---

## 5. Verifying it actually works

After deploying both sides, check in this order:

1. Visit `https://your-frontend-domain/api-health-check` — actually just visit your Worker URL directly: `https://your-worker-url/api/health`. You should see `{"status":"ok"}`. If this fails, the Worker isn't deployed correctly — nothing else will work until this does.
2. Open your site's `/admin/login` and open browser DevTools → Network tab before logging in. Attempt login.
   - If the request shows as **blocked/failed before a response**, or the console shows a CORS error mentioning "Access-Control-Allow-Origin" — go back to step 3, your current domain isn't in `PUBLIC_SITE_URL` yet.
   - If the request completes but returns 401 — your login credentials are wrong, or the admin user wasn't actually created (re-check step 1.6).
3. Once logged in, go to **Media Library** and upload a test image. It should appear immediately with a working thumbnail. If the thumbnail is broken, check that `WORKER_PUBLIC_URL` (step 1.5) matches your actual Worker URL exactly.
4. Go to **Gallery**, add an image, edit its caption, and reorder it — all three should work and persist after a page refresh.
5. Go to **Reviews**, open an existing review, click **Edit**, change the star rating, save — it should update immediately in the list.
6. Add a product to your cart from the public site, go to **Checkout**, fill in the shipping form, and complete a payment using your payment provider's test-mode card (see §6 below for where to find test card numbers). Confirm you land on the order confirmation page showing "Thank you," and that the order appears in **Admin → Orders** with status "Paid" and the product's stock reduced by the quantity ordered. If the order is stuck on "Confirming payment…" indefinitely, your webhook isn't configured correctly — see §6.
7. Log out from the sidebar — you should land on `/admin/login` immediately.
8. **Mobile-specific check (do this even if desktop looks fine):** on an actual phone (not just a resized desktop browser window — mobile Safari/WebKit's cookie handling doesn't match desktop DevTools' device emulation), log into `/admin/login`, wait a minute, then pull-to-refresh the page. If you're bounced back to the login screen even though the credentials were correct, the Worker is still on a different registrable domain than the frontend (e.g. `*.workers.dev` vs your custom domain) — see §4 step 3 for the fix. This is a cross-site-cookie limitation mobile browsers enforce more strictly than desktop, not a bug in the token logic itself.
9. **Incognito/private-browsing check:** open the public homepage in a private/incognito window. If the hero banner or other images fail to load with the browser console showing `net::ERR_BLOCKED` (not `404`), that's a content-blocker (ad-blocker extension, or the browser's own tracker-blocking in private mode) matching something in the request URL — not a server error. `404 Not Found` is a different problem: it means the stored media URL itself is stale, most often because `WORKER_PUBLIC_URL` (step 1.5) was changed after some items were already uploaded. Re-run the affected uploads, or see `workers/scripts/` for a one-time URL-repair script if this affects many existing items.

---

## 6. E-commerce setup (Stripe, Razorpay, order emails)

The cart, checkout, and order management system needs several secrets set
before it will actually process payments — without them, checkout fails
with a clear error rather than silently pretending to succeed (see
`workers/src/lib/payments.ts`), but the storefront won't be usable for
real orders until this section is done.

### 6.1 Stripe (card payments)

1. Create a [Stripe account](https://dashboard.stripe.com/register) if you don't have one.
2. **Dashboard → Developers → API keys.** Copy the **Publishable key** and **Secret key**. Use the *test mode* keys while setting up, switch to *live mode* keys only once you're ready to accept real payments.
3. Set the secret key on the Worker:
   ```bash
   npx wrangler secret put STRIPE_SECRET_KEY
   ```
4. Set the publishable key in the **Cloudflare Pages dashboard** (Settings → Environment variables) as `VITE_STRIPE_PUBLISHABLE_KEY` — this one is safe to expose client-side (that's what "publishable" means), so it does NOT go through `wrangler secret put`.
5. **Dashboard → Developers → Webhooks → Add endpoint.** URL: `https://<your-worker-domain>/api/webhooks/stripe`. Select the `payment_intent.succeeded`, `payment_intent.payment_failed`, and `payment_intent.canceled` events. Copy the **Signing secret** it generates and set it:
   ```bash
   npx wrangler secret put STRIPE_WEBHOOK_SECRET
   ```
   This webhook is the *only* thing that actually marks an order "Paid" (see `workers/src/routes/webhooks.ts`) — without it correctly configured, customers can pay successfully but their order will sit at "Awaiting payment" forever.
6. Test with [Stripe's test card numbers](https://stripe.com/docs/testing) (e.g. `4242 4242 4242 4242`, any future expiry, any CVC) before going live.

### 6.2 Razorpay (UPI and cards, primarily for Indian customers)

1. Create a [Razorpay account](https://dashboard.razorpay.com/signup).
2. **Dashboard → Settings → API Keys.** Generate a key pair. Use *test mode* while setting up.
3. Set both on the Worker:
   ```bash
   npx wrangler secret put RAZORPAY_KEY_ID
   npx wrangler secret put RAZORPAY_KEY_SECRET
   ```
4. **Dashboard → Settings → Webhooks → Add new webhook.** URL: `https://<your-worker-domain>/api/webhooks/razorpay`. Select the `payment.captured` and `payment.failed` events. Set a webhook secret (you choose this value yourself in Razorpay's UI) and set the same value on the Worker:
   ```bash
   npx wrangler secret put RAZORPAY_WEBHOOK_SECRET
   ```
5. Which payment methods actually appear at checkout (UPI, cards, netbanking, wallets) is controlled entirely by what's enabled on your Razorpay account, not by this codebase — check **Dashboard → Settings → Payment Methods**.
6. Test with [Razorpay's test mode](https://razorpay.com/docs/payments/payments/test-card-upi-details/) card/UPI details before going live.

### 6.3 Order confirmation emails (Resend)

1. Create a [Resend account](https://resend.com).
2. **Verify a sending domain** (Dashboard → Domains) — you need DNS access to the domain you want to send from (e.g. `icebrim.com`). This can take a few minutes to hours to verify depending on DNS propagation.
3. Update the `from` address in `workers/src/lib/email.ts` if it doesn't match your verified domain (it currently sends as `orders@icebrim.com`).
4. Generate an API key (Dashboard → API Keys) and set it:
   ```bash
   npx wrangler secret put RESEND_API_KEY
   ```
5. This is the only non-critical secret in this list — if it's missing or fails, order confirmation emails silently don't send but the order itself still completes correctly (see the try/catch around `sendOrderConfirmationEmail` in `routes/orders.ts`). Missing this won't break checkout, but customers won't get a receipt email.

### 6.4 Apply the new database migrations

This repair added new tables (`orders`, `order_items`, `order_status_history`) and a new `media.category` column. If you're updating an existing deployment rather than starting fresh, run:
```bash
npx wrangler d1 migrations apply icebrim-db --remote
```
and confirm it reports all 4 migrations as applied, not just however many existed before this update.

### 6.5 Confirm the stock-reservation cron is running

Checkout reserves stock for 20 minutes while a customer pays, then releases it automatically if they abandon checkout — partly on-demand (at the next checkout) and partly via a scheduled Cron Trigger that runs every 5 minutes (`workers/src/scheduled.ts`, configured in `wrangler.toml` `[triggers]`). Cron Triggers are enabled automatically on `wrangler deploy` — no extra dashboard step is needed, but you can confirm it's active under **Workers & Pages → icebrim-api → Triggers → Cron Triggers**.

---

## 7. Banner, blog, gallery, and review video/GIF support

The Banner, Gallery, and each Blog post's featured media can now be an **image, an animated GIF, or a short video (MP4/WEBM)** instead of only a static image. Reviews can have an admin-attached photo or video too, added from the review's Edit button.

### How to use it
- **Banner:** Admin → Banner → choose Image / Video / GIF, then upload. For video, you can also set an optional poster image (shown while the video loads).
- **Blog:** Admin → Blogs → edit a post → "Featured media" → choose Image / Video / GIF.
- **Gallery:** Admin → Gallery → Add Media (or edit an existing entry) → choose Image / Video / GIF.
- **Reviews:** Admin → Reviews → Edit on any review → "Attached photo or video" → choose None / Photo / Video.

### Size limits — and why there's no automatic video compression
Images are automatically compressed and resized on upload (down to max 2400px, re-encoded to WEBP), same as before. **Video and GIF are not compressed** — Cloudflare's Images binding (the tool this Worker uses to shrink images) can only process actual raster images; it cannot decode or transcode video. Because there's no server-side lever to shrink a video after upload, the upload size limit is what actually keeps banner/gallery video files small:

| Type | Limit | Compressed on upload? |
|---|---|---|
| Image (PNG/JPG/WEBP) | 8MB | Yes — auto-resized & re-encoded |
| GIF | 8MB | No — stored as-is |
| Video (MP4/WEBM) | 15MB | No — stored as-is |

**If your banner/gallery video is larger than 15MB, compress it before uploading.** For a banner-style short looping clip, aim for well under the limit — a few seconds at a moderate bitrate is normally only 1-4MB. Free tools that do this well:
- **HandBrake** (desktop, Windows/Mac/Linux) — use the "Web" preset, target 720p or 1080p, no audio track needed since banner video plays muted.
- **Squoosh / CloudConvert / FreeConvert** (browser-based, no install) — search "compress mp4 online."
- Command line, if you have `ffmpeg`: `ffmpeg -i input.mp4 -vf scale=1280:-2 -an -c:v libx264 -crf 28 output.mp4` (`-an` strips audio since banner video is always muted anyway; `-crf 28` is a reasonable size/quality tradeoff — lower number = larger file, higher quality).

### Aspect ratio / sizing guidance
- **Banner:** the banner section is full-width and roughly 3:2 to 16:9 depending on screen size. A landscape video/image around **1920×1080 (16:9)** works well and won't look stretched on ultra-wide screens or cropped awkwardly on mobile, since it's displayed with `object-cover`.
- **Gallery:** tiles are square-cropped in the admin grid but the public Gallery page uses a masonry layout that preserves each item's natural aspect ratio — any ratio works, but keep video clips short (a few seconds) since they show with playback controls, not autoplay.
- **Blog featured media:** displayed at a fixed **16:9** crop on both the post page and card thumbnails, so compose your source image/video/poster with the subject centered.

If your current banner or gallery images look too large/heavy on the live site even after this update, it's almost always because the *source file* uploaded was already large before compression, or because a video/GIF was used where a compressed image would do — re-uploading a properly-sized source (per the guidance above) fixes it; there's no separate "reduce size" setting to toggle.

---

## 8. Quick reference — every environment variable in this project

### Worker (`workers/wrangler.toml` — `[vars]`, not secret)
| Variable | Purpose | Example |
|---|---|---|
| `PUBLIC_SITE_URL` | Comma-separated list of allowed frontend origins (CORS) | `https://icebrim.pages.dev,https://icebrim.com` |
| `WORKER_PUBLIC_URL` | This Worker's own public URL, used to build media URLs | `https://icebrim-api.abc123.workers.dev` |
| `ENVIRONMENT` | Informational only | `production` |

### Worker secrets (`wrangler secret put <name>` — never in git)
| Secret | Purpose |
|---|---|
| `JWT_ACCESS_SECRET` | Signs short-lived login access tokens |
| `JWT_REFRESH_SECRET` | Signs longer-lived refresh tokens (must differ from the access secret) |
| `TURNSTILE_SECRET_KEY` | Verifies Cloudflare Turnstile CAPTCHA on public forms |
| `STRIPE_SECRET_KEY` | Stripe API secret key — see §6.1 |
| `STRIPE_WEBHOOK_SECRET` | Verifies Stripe webhook signatures — see §6.1 |
| `RAZORPAY_KEY_ID` | Razorpay API key id — see §6.2 |
| `RAZORPAY_KEY_SECRET` | Razorpay API key secret — see §6.2 |
| `RAZORPAY_WEBHOOK_SECRET` | Verifies Razorpay webhook signatures — see §6.2 |
| `RESEND_API_KEY` | Sends order confirmation emails — see §6.3 (non-critical; checkout still works without it) |

### Frontend (Cloudflare Pages → Settings → Environment variables)
| Variable | Purpose | Example |
|---|---|---|
| `VITE_API_BASE_URL` | The Worker URL the frontend calls | `https://icebrim-api.abc123.workers.dev` |
| `VITE_SITE_URL` | The frontend's own public URL, used for canonical/SEO tags | `https://icebrim.com` |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key — safe to expose, not a secret — see §6.1 | `pk_live_...` |

---

## 9. If something still doesn't work

- **Login still fails on the live domain:** almost always `PUBLIC_SITE_URL` (step 3) not listing the exact origin you're visiting from — check the browser's address bar domain against the list character-for-character, including `www.`.
- **Images broken sitewide:** `WORKER_PUBLIC_URL` (step 1.5) not set to your real Worker URL, or `VITE_API_BASE_URL` (step 2.1) not set in the Pages dashboard — check both.
- **Uploads succeed but nothing shows up:** open DevTools → Network on the upload request; a non-2xx response now returns a real error message (this was previously silent) — the message will say why.
- **Changes to `wrangler.toml` don't seem to take effect:** you have to run `npx wrangler deploy` again — editing the file alone doesn't push anything.
- **Changes to Pages env vars don't seem to take effect:** trigger a new deployment (push a commit, or use "Retry deployment" in the dashboard) — Vite bakes env vars in at build time, not runtime.
- **Order stuck on "Confirming payment…" / never shows as "Paid":** your Stripe/Razorpay webhook isn't configured, or its secret doesn't match — see §6.1/§6.2. Check the provider's dashboard (Developers → Webhooks → your endpoint → recent deliveries) for delivery failures; a 400 response there means the signature check failed (wrong secret set on the Worker), a connection error means the webhook URL itself is wrong.
- **Checkout fails immediately with "Unable to start payment right now":** the relevant payment secret (`STRIPE_SECRET_KEY` or `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET`) isn't set on the Worker yet — see §6.1/§6.2. This is checkout failing safely closed rather than a bug; check `wrangler tail` for the specific error logged.
- **Stripe card form doesn't appear / "Card payment is not configured yet" message:** `VITE_STRIPE_PUBLISHABLE_KEY` isn't set in the Pages dashboard, or the deployment hasn't picked it up yet (redeploy after setting it).
- **Admin gets logged out on mobile after refreshing, but desktop is fine:** this is the cross-site auth cookie issue described in §4 step 3 and §5 step 8. It happens because the Worker and frontend are on different registrable domains (e.g. Worker on `*.workers.dev`, frontend on your custom domain or `*.pages.dev`) — desktop browsers tolerate the resulting cross-site cookie, mobile Safari/WebKit does not reliably persist it. The code already handles both cases correctly (`workers/src/lib/cookies.ts` sets `SameSite=None; Secure` when cross-site); the fix is mapping the Worker to a same-site subdomain (e.g. `api.icebrim.com`) per §4 step 3, not a code change. Don't "fix" this by weakening cookie security (e.g. removing `Secure` or `HttpOnly`) — that reintroduces real vulnerabilities without solving the actual cause.
- **Some images 404 only for older uploads, new uploads are fine:** the affected items' stored `url` (in the `media`, `products`/`product_images`, `blog_posts`, `gallery_images`, or `site_content` — home/banner — records) was generated from an old `WORKER_PUBLIC_URL` value at the time they were uploaded. The underlying file in R2 is still there (uploads never delete the object), only the stored absolute URL is stale. Re-saving the item from the admin panel (re-picking the image) regenerates a correct URL; for a bulk fix see `workers/scripts/repair-media-urls.ts`.
- **Some images fail with `net::ERR_BLOCKED` in the browser console (not 404), especially in Incognito/private windows or with an ad-blocker installed:** this is the browser or an extension blocking the request client-side, not a server error — check the Network tab's "blocked" reason, or disable extensions to confirm. Media served from a URL path containing a filter-list-flagged word (classically `banner`/`banners`, `ads`, `track`, etc.) can be silently blocked by EasyList-style filter lists regardless of what the file actually is. This codebase's media categories avoid that (`hero-media` instead of `banners` — see `workers/src/routes/media.ts`); if you introduce a new upload category, avoid ad/tracker-adjacent words in it.
