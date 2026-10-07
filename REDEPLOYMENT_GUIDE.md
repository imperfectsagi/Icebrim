# Redeployment guide — fixes pass (content formatting, blog, FAQ, reviews, System Settings)

This is an update to an **already-live** site. Follow the steps in order. Nothing here changes
your Cloudflare setup (no new bindings, secrets or environment variables).

> **Before you start:** this update was tested with unit tests and a real-browser harness, but the
> full project could not be built where it was prepared (the package registry was unreachable).
> Step 3 therefore asks you to run the project's own build and type-check **before** deploying.
> If either reports an error, stop and send it over — do not deploy.

## What changed (summary)

| Area | What was wrong / added |
|---|---|
| Rich content | Lists had no bullets/numbers, paragraphs ran together (editor produced `<div>`s that the live site stripped), no H3, no paragraph/quote toggle. New editor + new shared styling, used by **blog, pages (About/FAQ), policies and product descriptions**. |
| Blog | Video/GIF featured media was never saved; editing an existing post opened an empty editor; save errors were swallowed; slug clashes on edit returned a 500; list endpoint sent every article body. All fixed. SEO title/description now drive `<title>`, meta description and social tags. |
| FAQ | New expand/collapse accordion (tap/click to open, again to close). |
| Reviews | "Read all reviews" now opens the full list in place (no redirect), with **Write a review above the list**. API no longer caps at 50. |
| Shop page | Heading is now **"Meet your relief"**. |
| System Settings | Maintenance mode is now enforced (site **and** API), with a **duration in days**; admin session timeout now genuinely logs out idle admins; Save shows success/errors. |

## 1. Back up the database (2 minutes)

```bash
cd workers
npx wrangler d1 export icebrim-db --remote --output=backup-before-fixes.sql
```

Keep that file. (Rollback notes are at the bottom.)

## 2. Replace the code

Unzip the new project over your existing repository folder (or commit it to your repo's main
branch if you deploy from Git). Your `.env.local`, `workers/.dev.vars` and `wrangler.toml` values
are **not** in the zip's secrets — but check `workers/wrangler.toml`: it contains your real
`database_id`, `PUBLIC_SITE_URL` and `WORKER_PUBLIC_URL`. If you edited those on your side, keep
your versions.

## 3. Build and type-check locally (required)

```bash
# Frontend (project root)
npm install
npm run build          # runs tsc -b && vite build — must finish with no errors
npm run lint           # optional

# Backend
cd workers
npm install
npx tsc --noEmit       # must print nothing
```

## 4. Apply the new database migration

```bash
cd workers
npx wrangler d1 migrations apply icebrim-db --remote
```

This applies **`0014_admin_session_activity.sql`** — one new nullable column
(`refresh_tokens.last_activity_at`). It is additive; nothing is dropped or rewritten.

## 5. Deploy the Worker (API) first, then the frontend

```bash
cd workers
npm run deploy
```

Then the frontend — either push to Git (if Cloudflare Pages is connected) or:

```bash
cd ..
npm run build
npx wrangler pages deploy dist --project-name=icebrim
```

Deploy the Worker **before** the frontend: the new admin screens call the new API fields.

## 6. What visitors and admins will notice right after deploying

* **Every admin is signed out once** and must log in again. (Sessions now carry an id so the
  inactivity timeout can be enforced; old sessions don't have one.)
* The default admin inactivity timeout is **15 minutes** (the value the screen always showed).
  Change it in **Admin → System Settings**. Typing/clicking/scrolling counts as activity, so
  working on a long post is safe.
* Existing blog posts, pages and policies keep their content. Posts saved earlier with `<div>`
  paragraphs are displayed as proper paragraphs automatically.
* Existing blog posts whose video/GIF choice was never saved will show as image posts until you
  re-select the media and save once (the data was never stored before).

## 7. Post-deploy check-list (10 minutes)

Do these on a **phone and a desktop**.

1. **Formatting** — Admin → Blogs → edit a post. Use H2, H3, Bold, Italic, bullet list, numbered
   list, quote, a link. Save, open the post on the live site: bullets/numbers show, paragraphs are
   separated, the quote is indented with a bar, nothing scrolls sideways.
2. **Edit existing post** — open an existing post: the content is in the editor (not blank).
3. **Blog fields** — create a **Draft** post → confirm it is *not* on `/blog`. Switch to
   **Published** → it appears on `/blog` and at `/blog/<slug>`. Try an Image, a GIF and a Video
   post. View source/inspect `<head>` on the post: `<title>` = SEO meta title, meta description =
   SEO meta description.
4. **Duplicate slug** — create a post with an existing slug: a clear error message appears.
5. **FAQ** — see "Setting up the FAQ" below. Tap a question: answer opens; tap again: closes.
6. **Reviews** — homepage → **Read all reviews**: the full list opens in place, **Write a review**
   is above it, and you stay on the homepage. Submit a test review (it stays pending until you
   approve it in Admin → Reviews).
7. **Shop page** — `/products` heading reads **Meet your relief**.
8. **Maintenance** — Admin → System Settings: tick **Enable maintenance mode**, set a message and
   e.g. **2** days, Save. Open the site in a private window: maintenance page with the message and
   "Expected back" date (appears within ~30 s of saving). Admin (`/admin`) still works. Untick,
   Save: site is back.
9. **Session timeout** — set the timeout to **5**, Save, leave the admin tab untouched for 5+
   minutes: you are returned to the login page with an inactivity message. Set it back to what
   you want afterwards.

## Setting up the FAQ

The FAQ is a normal page (Admin → Pages), shown as an accordion when its **URL slug or title
contains "faq"** (e.g. slug `faq`, title "FAQs").

1. Admin → Pages → *Add Page* (or edit your existing FAQ page). Slug: `faq`.
2. In the editor, write each **question as a Heading 3** and the **answer as the paragraph(s)
   under it**. Text before the first question becomes an intro line.
3. Save. On the live site each question is a tap-to-open/tap-to-close item.

(Questions written as a fully-bold line ending in "?" also work.)

## System Settings — how it behaves

* **Maintenance duration (days):** how many days you expect maintenance to last. It counts from
  the moment you switch maintenance on; visitors see the expected return date. `0` = no date.
* **It stays on until you switch it off**, however many days pass — *unless* you tick
  "Switch maintenance off automatically when the days are up".
* While on, the public site shows the maintenance page **and** the API refuses new orders,
  contact/newsletter/review/popup submissions (HTTP 503). Payment-provider webhooks and
  `/admin` keep working, so a payment already in progress still completes.
* **Admin session timeout (minutes):** 5–1440. Idle admins are logged out by the browser *and*
  by the server.

## Rollback

* **Frontend:** Cloudflare Pages → your project → Deployments → pick the previous deployment →
  *Rollback*.
* **Worker:** `cd workers && npx wrangler rollback` (or Dashboard → Workers → icebrim-api →
  Deployments).
* **Database:** migration 0014 only adds a nullable column and is harmless to leave in place when
  rolling code back. You should not need to restore the backup; keep it for safety.

## Known notes

* Page titles / social tags are set in the browser (as before). Google runs JavaScript and reads
  them; some social-preview scrapers do not. If rich link previews matter, a server-side
  pre-render of `/blog/*` meta tags is a possible later improvement.
* The home page's "Shop" section heading (Admin → Home Sections) is separate content and was not
  changed; only the `/products` page heading was changed, as requested.
