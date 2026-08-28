# Icebrim — Deployment Checklist

This covers the changes made in this fix pass only (the four requirement
documents: buyer review upload, branding-color flash, delivery
information, and page routing/CMS expansion). It assumes you already have
a working production deployment per `DEPLOYMENT.md`, which now also has a
new §10 covering everything below in more detail.

Every change in this pass was tested by actually running the app locally
against a real `wrangler dev` server and a real local D1 database — not
just built/typechecked — including the exact request flows described in
each requirement document's own test steps. See §5 for what was verified
and how.

---

## 1. What changed (summary)

| Requirement | Status | Notes |
|---|---|---|
| Buyer review photo/video upload broken | **Fixed** | Root cause: a database constraint, not the upload code itself — see §2 |
| Branding-color flash (`#11534E`) on refresh | **Fixed** | Client-side caching fix, no backend change |
| Delivery Information Management | **Added** (new feature) | No prior system existed — confirmed by search before building |
| Custom page routing (`/about`, not `/pages/about`) | **Changed** | Also affects last session's Page Management feature |
| Home/About section admin editing | **Added** (new feature) | About was 100% hardcoded before this |
| Rich text: headings/lists/quotes/links | **Fixed** | Quote/blockquote button was missing from the editor toolbar |
| Expand/Collapse for long content | **Added** (new feature) | Auto-applies to long pages; not forced onto short ones |
| Fixed-amount coupon discount bug | *(from prior session, unaffected by this pass — already fixed)* | — |

### Files changed or added this pass

**Database migrations (new)**
- `workers/db/migrations/0008_pages.sql` *(from prior session — unchanged this pass)*
- `workers/db/migrations/0009_product_video.sql` *(from prior session — unchanged this pass)*
- `workers/db/migrations/0010_review_multi_image.sql` *(from prior session — unchanged this pass)*
- `workers/db/migrations/0011_add_reviews_media_category.sql` — **new this pass**, fixes the review-upload bug
- `workers/db/migrations/0012_about_page_cms.sql` — **new this pass**, seeds the About page as real content

**Backend (Workers)**
- `workers/src/routes/media.ts` — new public `POST /api/media/review-upload` endpoint; `'reviews'` added to the category allowlist
- `workers/src/routes/pages.ts` — `is_system` support (About page protection), reserved-slug rejection
- `workers/src/routes/admin-content.ts` — new `delivery-info` admin + public endpoints
- `workers/src/lib/schemas.ts` — `deliveryInfoWriteSchema`, `RESERVED_PAGE_SLUGS`

**Frontend**
- `index.html` — inline pre-hydration script for the branding-color cache
- `src/components/common/ThemeLoader.tsx` — writes the resolved accent color to `localStorage`
- `src/components/common/DeliveryInfo.tsx` — **new**, shared delivery-estimate display component
- `src/components/common/ReadMoreSection.tsx` — **new**, expand/collapse for long content
- `src/components/common/ExpandableSection.tsx` — **new**, reusable disclosure building block
- `src/router.tsx` — `/pages/:slug` replaced with a direct `:slug` catch-all route
- `src/pages/CustomPage.tsx` — updated for direct-slug routing, uses `ReadMoreSection`
- `src/pages/AboutPage.tsx` — now reads from CMS content instead of hardcoded prose
- `src/pages/ProductDetailPage.tsx`, `CheckoutPage.tsx`, `OrderConfirmationPage.tsx`, `OrderStatusPage.tsx` — `<DeliveryInfo />` added
- `src/features/admin/pages/AdminDeliveryPage.tsx` — **new**
- `src/features/admin/pages/AdminHomeSectionsPage.tsx` — **new** (How It Works / Why Icebrim / Home About editor)
- `src/features/admin/pages/AdminPagesPage.tsx`, `AdminPageFormPage.tsx` — built-in page protection UI
- `src/features/admin/components/RichTextEditor.tsx` — Quote/blockquote toolbar button added
- `src/features/admin/components/AdminLayout.tsx`, `AdminApp.tsx` — new nav entries and routes
- `src/hooks/useContent.ts` — `useDeliveryInfo`
- `src/types/cms.ts` — `DeliveryInfoContent`, `CmsPage.isSystem`

---

## 2. Database migrations required

Two new migrations this pass, applied in order after everything from the
prior session (0001–0010):

```
0011_add_reviews_media_category.sql  — fixes the review-upload bug (see below)
0012_about_page_cms.sql              — seeds the About page as editable content
```

Both are additive. `0011` rebuilds the `media` table (same pattern the
codebase already uses for this kind of change — see
`0006_rename_banners_category.sql`) to widen a `CHECK` constraint; every
existing row is preserved exactly. `0012` adds one new column and inserts
exactly one new row, seeded with the site's *existing* About page copy —
nothing currently on the site changes as a result of applying it.

Apply with:

```bash
cd workers
npx wrangler d1 migrations apply icebrim-db --remote
```

Verified in this pass: all 12 migrations (0001–0012) apply cleanly in
order against a fresh local D1 instance, and also apply cleanly when run
against a database that already had 0001–0010 applied (the realistic
upgrade path for an existing deployment).

### ⚠️ Why migration 0011 matters — read this before deploying

If you deployed the prior session's review-media-upload feature to
production **before** this fix, every customer attempt to attach a photo
or video to a review has been failing (returning a generic error to the
buyer). This is not a frontend bug and not something a redeploy of the
frontend alone fixes — it's a database constraint that migration `0011`
corrects. **Applying this migration is what actually resolves it.**

---

## 3. Environment / configuration requirements

**No new environment variables or secrets are required** for anything in
this pass.

One new **public, unauthenticated** route is added to the Worker:
`POST /api/media/review-upload`. If your Worker sits behind any
firewall/WAF rule that allowlists specific paths, make sure this one is
reachable the same way `/api/reviews` already is. It uses the same
`FORM_RATE_LIMITER` binding already configured for other public forms —
no new binding to add.

---

## 4. Deployment steps

1. **Back up your D1 database:**
   ```bash
   npx wrangler d1 export icebrim-db --remote --output backup-pre-pass2.sql
   ```
2. **Apply the new migrations:**
   ```bash
   cd workers
   npx wrangler d1 migrations apply icebrim-db --remote
   ```
3. **Deploy the Worker:**
   ```bash
   npx wrangler deploy
   ```
4. **Build and deploy the frontend:**
   ```bash
   npm install
   npm run build
   # deploy dist/ to your static host
   ```
5. **Read §10 of `DEPLOYMENT.md`** for the full detail behind each change above.
6. **Smoke-test in production** — see §5 below and the expanded checklist in `DEPLOYMENT.md` §5.

---

## 5. What was actually tested, and how

Every item below was verified by running the real application (via
`wrangler dev` against a real local D1 database, or the actual production
build), not just by reading the code:

- **Review upload bug:** reproduced the original 500 error live, applied
  the fix, then re-ran the full flow — image upload, video upload, review
  submission referencing both, confirmed via direct database query that
  everything persisted correctly. Also tested: unsupported file type,
  oversized video, rate limiting, and a review submitted with no media at
  all — all behave correctly.
- **Branding flash:** extracted the actual pre-hydration script from the
  real production build (`dist/index.html`) and ran it against a real DOM
  (jsdom) through all 5 scenarios the requirement's own test plan lists —
  cached color applied immediately, no cache falls through to the real
  default, an explicitly-saved `#11534E` still works, a corrupted cache
  value fails safe, and a second color change also works.
- **Delivery Info:** full save → public-read → update → disable → re-read
  cycle tested against a live server, plus schema validation (rejects
  missing fields, rejects overly long text) and auth enforcement (rejects
  unauthenticated writes).
- **Page routing:** tested the *actual* `react-router-dom` route matcher
  (not a manual re-implementation) against the real route list — every
  static route correctly wins over the new dynamic catch-all, so there is
  no collision risk with `/products`, `/checkout`, etc.
- **About page conversion:** tested live — public read, admin content
  edit (allowed), admin slug-change attempt (rejected), admin delete
  attempt (rejected), disable → public 404 → re-enable → public 200.
- **New custom pages:** tested live — creating a page with a reserved
  slug is rejected (409), creating one with a valid slug works and is
  immediately publicly readable, including blockquote content surviving
  the sanitizer correctly.
- **Home Sections editor:** tested live — updating How It Works / Why
  Icebrim / Home About (including the visibility toggle) via the same
  merge the admin UI performs, while confirming every *other* section of
  the home content (hero, featured products, reviews, blog, CTA, SEO) is
  byte-for-byte unchanged after the update.

Frontend build (`npm run build`), lint (`npm run lint`), and Worker
typecheck (`npm run typecheck`, inside `workers/`) all pass with zero
errors as of this ZIP.

---

## 6. Final verification checklist (production, after deploying)

- [ ] `/about` still loads correctly, and its content matches what was
      there before this deployment
- [ ] Admin → Pages shows "About" with a "Built-in" badge; its URL field
      is locked; editing its title/content and saving works
- [ ] Create a new page in Admin → Pages (e.g. slug `faq`), publish it,
      confirm it loads at `/faq`; disable it, confirm `/faq` now 404s
- [ ] Every existing static page still loads correctly: `/products`,
      `/blog`, `/gallery`, `/contact`, `/checkout`, `/privacy-policy`,
      `/terms`, `/cookie-policy`
- [ ] As a logged-out visitor, submit a review with a photo and a short
      video attached — it should succeed (not error)
- [ ] In Admin → Reviews, find that review and confirm the attached media
      is visible
- [ ] In Admin → Branding, save a non-default color, hard-refresh the
      site — the saved color shows immediately, no flash of `#11534E`
- [ ] In Admin → Delivery Info, turn it on with sample text, confirm it
      shows on a product page, checkout, and order confirmation
- [ ] In Admin → Home Sections, edit How It Works or Why Icebrim, save,
      confirm the home page reflects the change and the Hero/Banner
      section is untouched
- [ ] Full regression pass on anything this session didn't intentionally
      touch: login, cart, checkout payment, orders, coupons, blog,
      gallery — this pass did not intend to change any of these, but a
      quick pass is worth doing after any deployment
