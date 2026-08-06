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

> `ADMIN_SETUP_TOKEN` exists in the type definitions but isn't wired to any route in this codebase — don't rely on it to bootstrap an admin. Use the script in step 1.5 instead.

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

Cloudflare Pages environment variables **override** whatever is in `.env.production` in the repo — set it in the dashboard rather than relying on the committed file:

**Pages dashboard → your project → Settings → Environment variables → Production:**

| Variable | Value |
|---|---|
| `VITE_API_BASE_URL` | the exact Worker URL from step 1.4, e.g. `https://icebrim-api.your-subdomain.workers.dev` — **no trailing slash** |

If you also use a Pages **Preview** environment (e.g. for pull requests), set the same variable there too, or preview deploys will silently fall back to local seed data instead of your live API.

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
6. Log out from the sidebar — you should land on `/admin/login` immediately.

---

## 6. Quick reference — every environment variable in this project

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

### Frontend (Cloudflare Pages → Settings → Environment variables)
| Variable | Purpose | Example |
|---|---|---|
| `VITE_API_BASE_URL` | The Worker URL the frontend calls | `https://icebrim-api.abc123.workers.dev` |

---

## 7. If something still doesn't work

- **Login still fails on the live domain:** almost always `PUBLIC_SITE_URL` (step 3) not listing the exact origin you're visiting from — check the browser's address bar domain against the list character-for-character, including `www.`.
- **Images broken sitewide:** `WORKER_PUBLIC_URL` (step 1.5) not set to your real Worker URL, or `VITE_API_BASE_URL` (step 2.1) not set in the Pages dashboard — check both.
- **Uploads succeed but nothing shows up:** open DevTools → Network on the upload request; a non-2xx response now returns a real error message (this was previously silent) — the message will say why.
- **Changes to `wrangler.toml` don't seem to take effect:** you have to run `npx wrangler deploy` again — editing the file alone doesn't push anything.
- **Changes to Pages env vars don't seem to take effect:** trigger a new deployment (push a commit, or use "Retry deployment" in the dashboard) — Vite bakes env vars in at build time, not runtime.
