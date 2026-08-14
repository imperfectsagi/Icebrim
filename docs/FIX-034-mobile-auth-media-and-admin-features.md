# FIX-034 — Mobile auth, media loading, and admin/mobile feature build

This covers both source documents: the mobile-logout/media-404 investigation, and
the follow-on admin panel + mobile UI requirements. Written after reading the
actual code (not guessing) -- see inline comments in the referenced files for the
detailed reasoning; this doc is the top-level summary.

---

## A. Root cause — mobile logout after refresh

**Cross-site auth cookie.** The Worker (`icebrim-api.brand-launch-studio.workers.dev`)
and the frontend (`icebrim.com`) are on different registrable domains. The cookie
code (`workers/src/lib/cookies.ts`, `workers/src/routes/auth.ts`) already correctly
sets `SameSite=None; Secure` for this case -- that's valid and is what cross-site
cookies require. The problem is that **mobile Safari/WebKit enforces cross-site
cookie restrictions more aggressively than desktop browsers**, even when the cookie
is spec-valid, so the cookie set at login doesn't reliably survive to the refresh
request on mobile. Desktop tolerates it; mobile doesn't.

CORS was checked and is correctly configured (exact origin echo, not `*`;
`Access-Control-Allow-Credentials: true`; `Vary: Origin`) -- ruled out as a cause.
The frontend's `AuthContext.tsx` was checked and does not incorrectly clear state;
it clears state because the cookie is genuinely absent on that request.

**This is not a code bug.** It's fixed by removing the cross-site relationship
entirely: map the Worker to a subdomain of `icebrim.com` (e.g. `api.icebrim.com`).
Once same-site, the cookie can go back to `SameSite=Lax`, which mobile handles
normally. See `DEPLOYMENT.md` §4 (already had this written up from a prior audit,
FIX-033) and the newly added §5 step 8 / §9 troubleshooting entries for the exact
Cloudflare steps and how to verify it.

## B. Root cause — Incognito loading failures / C. Root cause — media 404s

**Two separate causes, confirmed distinct:**

1. **404s** — `media.url` (and every content table that copies it: `product_images.src`,
   `blog_posts.featured_image_src`/`featured_video_src`, `gallery_images.src`/`video_src`,
   `reviews.media_src`, `site_content` home/banner JSON) stores a **full absolute URL
   generated from `WORKER_PUBLIC_URL` at upload time** (`workers/src/routes/media.ts`),
   not recomputed on read. If `WORKER_PUBLIC_URL` was ever different in the past,
   every item uploaded before the change still points at the old host. The R2 object
   itself never moved -- `r2_key` is untouched -- so this is a stale-reference problem,
   not a missing-file problem.

2. **`net::ERR_BLOCKED`** — separate cause. The media category `banners` produced URLs
   containing the literal path segment `uploads/banners/...`. That's a standard
   ad/tracker filter-list keyword; content blockers (including the tracker-blocking
   most browsers enable by default in private/Incognito mode) block it client-side
   regardless of what the file is. This looks identical to a server outage from the
   user's side but isn't one.

## D. Whether `net::ERR_BLOCKED` is the application or the browser

**The browser/an extension**, via filter-list matching on the URL text (specifically
the word "banners" in the path). Confirmed by checking which category names exist in
the codebase's closed `MEDIA_CATEGORIES` list -- `banners` was the only one that's a
known blocklist keyword; `products`, `blog`, `company`, `gallery`, `other` are not.
Fixed by renaming the category (not by trying to work around the blocker, which
isn't reliable or appropriate).

## E/F. Exact files modified and code changes

**Problem 1/2 fixes:**
- `src/features/admin/auth/AuthContext.tsx` — corrected a stale comment (said
  `SameSite=Strict`, code actually and correctly sets `SameSite=None`).
- `workers/src/routes/media.ts` — `MEDIA_CATEGORIES`: `'banners'` → `'hero-media'`.
- `workers/db/migrations/0006_rename_banners_category.sql` — **new**. Rebuilds the
  `media` table with the corrected CHECK constraint; relabels existing `banners` rows
  to `hero-media` in the `category` column. Tested against a live SQLite engine
  (all 7 migrations apply cleanly in sequence; data survives; constraint enforced).
- `workers/scripts/repair-media-urls.ts` — **new**. Dry-run-by-default script that
  (a) rewrites any `media.url` whose host doesn't match the current
  `WORKER_PUBLIC_URL`, and propagates the fix to every table that copied that URL;
  (b) with `--rename-banners`, moves the actual R2 objects out of
  `uploads/banners/...` into `uploads/hero-media/...` and updates `r2_key`/`url`
  to match. Never deletes an R2 object until its copy is confirmed written.
- `DEPLOYMENT.md` — added a mobile-specific verification step, an Incognito
  verification step, and three new troubleshooting entries covering all of the above.
- `src/features/admin/components/ImageUploadField.tsx`,
  `src/features/admin/pages/AdminBannerPage.tsx`,
  `src/features/admin/pages/AdminMediaPage.tsx` — updated the frontend's
  `MediaCategory` type and every `category="banners"` usage to `"hero-media"` to
  match the backend rename (caught via TypeScript once the type changed).

**Feature work (see `ADDITIONAL PRODUCTION REQUIREMENTS` doc, items 1-9):**

*Gallery admin delete (item 1)* — already existed end-to-end; only gap was a missing
confirmation dialog.
- `src/features/admin/pages/AdminGalleryPage.tsx` — added a `ConfirmDeleteDialog`
  (mirrors the existing pattern from `AdminProductsPage.tsx`) before delete fires.

*Policy pages CMS (item 2)* — previously hardcoded JSX; now admin-editable, reusing
the existing `site_content` key/value pattern and the existing blog rich-text
sanitization pipeline (`sanitizeBlogHtml`, `RichText.tsx`, `RichTextEditor.tsx`).
- `workers/src/lib/schemas.ts` — added `policyPageWriteSchema`.
- `workers/src/routes/admin-content.ts` — added GET/PUT/DELETE
  `/api/admin/content/policy/:key` for the 3 fixed keys.
- `workers/src/routes/content.ts` — added public GET `/api/content/policy/:key`.
- `src/types/cms.ts` — added `PolicyPageContent`/`PolicyPageKey`.
- `src/data/policy.ts` — **new**. Seed content = the exact copy that was previously
  hardcoded in the three page components, so nothing was lost.
- `src/hooks/useContent.ts` — added `usePolicyPage(key)`.
- `src/features/admin/hooks/useAdminPolicy.ts` — **new**. Admin read/update/delete hooks.
- `src/features/admin/pages/AdminPoliciesPage.tsx`,
  `src/features/admin/pages/AdminPolicyFormPage.tsx` — **new**. List page + edit form
  (title, date label, rich text editor, save, "clear content" with confirmation).
- `src/features/admin/AdminApp.tsx`, `src/features/admin/components/AdminLayout.tsx`
  — registered routes and added a "Policy Pages" nav item.
- `src/pages/PrivacyPolicyPage.tsx`, `src/pages/CookiePolicyPage.tsx`,
  `src/pages/TermsPage.tsx` — rewritten to fetch and render CMS content instead of
  hardcoded JSX.

*Company content (item 3)* — already CMS-driven via the existing `site_content`
`company` key; no change needed, confirmed pattern is consistent with the above.

*Newsletter section removal (item 4)*
- `src/components/layout/Footer.tsx` — removed the "Get 10% off" block and the
  `NewsletterForm` import.
- `src/components/common/NewsletterForm.tsx` — **deleted** (confirmed unused
  elsewhere first; it was a non-functional stub, not wired to the real backend).
- Left `workers/src/routes/contact.ts`'s `/api/newsletter` route and the
  `newsletter_subscribers` table untouched -- confirmed it's a separate, real
  capability, not exclusive to the removed section.

*Coupon system (item 5)*
- `workers/db/migrations/0007_coupons.sql` — **new**. `coupons` table (percentage or
  fixed discount, active flag, expiry, usage limit/count, minimum order amount) plus
  `orders.coupon_id`/`orders.coupon_code`. Tested against live SQLite, including
  every CHECK constraint and the `ON DELETE SET NULL` behavior for order history.
- `workers/src/lib/coupons.ts` — **new**. The single source of truth for coupon
  validation and discount calculation (percentage/fixed, expiry, usage limit,
  minimum order, clamped so a discount can never exceed the subtotal or go
  negative). Unit-tested directly (9 cases, all passing).
- `workers/src/lib/schemas.ts` — added `couponWriteSchema`, `couponPreviewSchema`.
- `workers/src/routes/admin-coupons.ts` — **new**. Admin CRUD.
- `workers/src/routes/orders.ts` — checkout now accepts an optional `couponCode`,
  re-validates and prices it server-side (never trusts a client-sent discount,
  consistent with how this handler already treats product prices), records
  `coupon_id`/`coupon_code` on the order, and atomically guards the usage-limit
  increment in the same D1 batch as order creation (same pattern already used for
  stock decrement). Also added a read-only `POST /api/orders/validate-coupon`
  preview endpoint so the checkout UI can show a discount before final submit,
  using the exact same validation logic.
- `workers/src/index.ts` — registered `/api/admin/coupons`.
- `src/types/cms.ts` — added `Coupon`, `Order.couponCode`.
- `src/features/admin/hooks/useAdminCoupons.ts` — **new**.
- `src/features/admin/pages/AdminCouponsPage.tsx` — **new**. List, create/edit modal,
  delete-with-confirmation.
- `src/features/admin/AdminApp.tsx`, `AdminLayout.tsx` — registered route, added
  "Coupons" nav item under a new "Sales" section.
- `src/pages/CheckoutPage.tsx` — coupon code input, live server-validated preview,
  discount line in the order summary, `couponCode` passed to checkout, and handling
  for the case where a coupon becomes invalid between preview and final submit.

*Responsive hero (item 6)*
- `src/types/cms.ts` — added optional `image.mobileSrc` (backward-compatible;
  existing content with only a desktop image is unaffected).
- `src/components/sections/HeroBanner.tsx` — renders a real `<picture>`/`<source>`
  for a genuinely different mobile image below the `sm` breakpoint (not a CSS crop
  of the desktop image), and switches the frost gradient from left-to-right
  (desktop) to top-to-bottom (mobile), since the left-to-right composition only
  works with the extra horizontal room desktop has -- on mobile it was washing out
  the image and contributing to the "crowded" look independently of the crop issue.
- `src/features/admin/pages/AdminBannerPage.tsx` — added a "Mobile image (optional)"
  upload field alongside the existing desktop image field.

*Mobile UI audit / breakpoints (items 7-8)* — the codebase already had a prior
mobile audit (`docs/FIX-012-mobile-audit.md`) that found the public site mobile-first
and correct outside the admin panel; re-verified this is still accurate and didn't
re-touch already-working areas, per the explicit instruction not to blindly rewrite
things. The one concrete, real issue raised (hero) is fixed above. No new
breakpoints were introduced -- everything uses Tailwind's existing `sm`/`md`/`lg`
scale.

*Image/media architecture (item 9)* — no new hardcoded external URLs introduced;
new coupon and policy features re-use the existing `site_content`/`media` pattern
end-to-end.

## G. Required Cloudflare configuration changes

1. **Custom domain for the Worker** (fixes A): in the Worker's dashboard, add a
   Custom Domain, e.g. `api.icebrim.com`, on the `icebrim.com` zone (already in the
   client's Cloudflare account per the DNS/Workers permissions granted). This is a
   dashboard action, not a code change -- see `DEPLOYMENT.md` §4 for the exact steps
   already documented there.
2. No DNS records need deleting; no existing deployments need deleting.

## H. Required environment variables

- `WORKER_PUBLIC_URL` — update to the new custom domain once mapped (e.g.
  `https://api.icebrim.com`), in `workers/wrangler.toml` `[vars]` and re-deploy.
- `VITE_API_BASE_URL` — update the Pages project's build variable to match, and
  redeploy the frontend.
- No new secrets are required for anything in this change set. No secrets were
  read, logged, or hardcoded anywhere in this work.

## I/J. Codespaces / Git and deployment commands

```bash
# From the repo root
cd workers
npm install
npm run db:migrate:local     # apply 0006 + 0007 locally first, verify
npm run db:migrate:remote    # then apply to production D1

# One-time media repair (see script header for full docs) -- dry run first:
node --experimental-strip-types scripts/repair-media-urls.ts --remote
# then, once you're happy with the plan:
node --experimental-strip-types scripts/repair-media-urls.ts --remote --confirm --rename-banners

npm run deploy                # deploy the Worker

cd ..
npm install
npm run build
# Deploy dist/ via your existing Cloudflare Pages flow (git push, or
# `npx wrangler pages deploy dist` if deploying directly)
```

After the custom domain is mapped (§G), update `WORKER_PUBLIC_URL` and
`VITE_API_BASE_URL` and redeploy both.

## K. Verification steps

**Desktop (normal):** log in, refresh, confirm still authenticated; products/items
load; banners/gallery images load.

**Desktop (Incognito):** same as above; specifically check the Network tab for any
`net::ERR_BLOCKED` entries (should be none now that `hero-media` replaces `banners`)
and any `404` entries (should be none for newly-uploaded items; existing items need
the repair script run once, per §I).

**Mobile (normal browser):** log in, wait, refresh -- should remain authenticated
once the custom domain is mapped. Before that Cloudflare change is made, this will
still fail; that's the expected, documented behavior until §G is done.

**Feature regression:**
- Gallery: delete now prompts for confirmation; deleted items disappear from the
  public Gallery page; other pages unaffected.
- Policy pages: edit each of the three in Admin → Policy Pages, confirm the public
  page reflects the change immediately.
- Newsletter section: confirm it no longer appears in the footer on desktop or
  mobile; confirm the rest of the footer and its links are unaffected.
- Coupons: create a coupon in Admin → Coupons; apply it at checkout; confirm the
  discount shown matches what's actually charged; confirm an invalid/expired/
  disabled code shows an error and applies no discount.
- Hero: check the homepage on both a desktop width and a real mobile device (not
  just a resized browser window) with and without a mobile image set.
