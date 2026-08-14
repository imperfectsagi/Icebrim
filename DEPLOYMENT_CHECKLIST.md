# Icebrim — Deployment Checklist

This covers the changes made in this fix pass only. It assumes you already
have a working production deployment (D1 database, R2 bucket, Workers
project, Pages/static frontend host) per the existing `DEPLOYMENT.md`.

---

## 1. What changed (summary)

| # | Requirement | Status |
|---|---|---|
| 1 | Footer hardcoded "Rotation Twin Pack" | **Fixed** |
| 2 | Checkout input border visibility | **Fixed** |
| 3 | Admin Page Management (add/edit/delete/publish) | **Added** (new feature) |
| 4 | Product video upload | **Added** |
| 5 | Review image/video upload (customer) + admin management | **Added** |
| 6 | Hero/Banner text-color selector | **Already present** — verified working, no changes needed |
| 7 | Coupon fixed-discount amount | **Fixed** |
| 8 | Admin ON/OFF promo banner note | **Already present** — verified working, no changes needed |

Items 6 and 8 were found to be fully implemented and correctly wired
already in the uploaded project (frontend, backend, and database all
consistent). They were verified end-to-end but not modified.

### Files changed

**Frontend**
- `src/components/layout/Footer.tsx` — shop links now come from live product data
- `src/pages/CheckoutPage.tsx` — visible, on-theme input borders
- `src/types/cms.ts` — added `CmsPage`, `Product.videoUrl`, `Review.mediaImages`
- `src/hooks/useContent.ts` — added `useCmsPage`
- `src/router.tsx` — added `/pages/:slug` public route
- `src/pages/CustomPage.tsx` — **new**: public renderer for admin-managed pages
- `src/pages/ProductDetailPage.tsx` — product video shown in the gallery
- `src/components/common/ReviewForm.tsx` — customer photo/video upload UI
- `src/components/common/ReviewCard.tsx` — displays attached review photos
- `src/features/admin/AdminApp.tsx` — new `/admin/pages` routes
- `src/features/admin/components/AdminLayout.tsx` — "Pages" nav entry
- `src/features/admin/components/ImageUploadField.tsx` — added `reviews` category
- `src/features/admin/hooks/useAdminPages.ts` — **new**
- `src/features/admin/hooks/useAdminReviews.ts` — added `mediaImages` support
- `src/features/admin/pages/AdminPagesPage.tsx` — **new**
- `src/features/admin/pages/AdminPageFormPage.tsx` — **new**
- `src/features/admin/pages/AdminProductFormPage.tsx` — video upload field
- `src/features/admin/pages/AdminReviewsPage.tsx` — view/remove customer photos

**Backend (Workers)**
- `workers/db/migrations/0008_pages.sql` — **new**: `pages` table
- `workers/db/migrations/0009_product_video.sql` — **new**: `products.video_url`
- `workers/db/migrations/0010_review_multi_image.sql` — **new**: `reviews.media_images`
- `workers/src/routes/pages.ts` — **new**: public + admin Page Management API
- `workers/src/routes/products.ts` — read/write `videoUrl`
- `workers/src/routes/reviews.ts` — read/write `mediaImages`
- `workers/src/routes/media.ts` — new public, rate-limited upload endpoint for review attachments
- `workers/src/routes/admin-coupons.ts` — fixed-discount storage bug
- `workers/src/lib/schemas.ts` — `pageWriteSchema`, `productWriteSchema.videoUrl`, review schema `mediaImages`
- `workers/src/index.ts` — registers the new `pages` and `publicMedia` routes

---

## 2. Database migrations required

Three new migrations, applied in order after your existing ones (0001–0007):

```
0008_pages.sql            — creates the `pages` table (new feature, additive)
0009_product_video.sql    — adds `products.video_url` (nullable column, additive)
0010_review_multi_image.sql — adds `reviews.media_images` (nullable-default column, additive)
```

All three are **purely additive** — new table or new nullable/defaulted
columns. Nothing is dropped, renamed, or backfilled destructively. No
existing data is reset or reseeded.

Apply with:

```bash
cd workers
npx wrangler d1 migrations apply icebrim-db --remote
```

Verified locally in this fix pass: all 10 migrations (0001–0010) applied
cleanly in sequence against a fresh local D1 instance with no errors.

### ⚠️ One data issue this fix pass found but did NOT auto-correct

The coupon fixed-discount bug (item 7) means that **any fixed-amount
coupon created before this fix** may have been stored with the wrong
value (e.g. an intended "£5 off" coupon stored as 5 pence instead of 500
pence). This fix corrects the bug going forward (new/edited coupons save
correctly), but it does **not** touch existing rows, because there's no
safe way to distinguish "already-broken" rows from "coincidentally small"
ones without inspecting your actual production data.

**Before or immediately after deploying, check this yourself:**

```bash
npx wrangler d1 execute icebrim-db --remote \
  --command "SELECT code, discount_type, discount_value FROM coupons WHERE discount_type = 'fixed';"
```

For each row, `discount_value` should be in **pence** (e.g. a "£5 off"
coupon should show `500`, not `5`). If you find rows where the value
looks like it's in pounds instead of pence, fix them with:

```sql
UPDATE coupons SET discount_value = discount_value * 100
WHERE discount_type = 'fixed' AND id = '<the specific coupon id>';
```

Do this per-coupon after visually confirming each one — do not run a
blanket `* 100` across all fixed coupons without checking, in case any
were already correct.

---

## 3. Environment / configuration requirements

No new environment variables, secrets, or bindings are required. This fix
pass uses only bindings and secrets that already exist in the project
(`DB`, `MEDIA_BUCKET`, `IMAGES`, `FORM_RATE_LIMITER`).

One new **route** is added to the Worker's public surface:
- `POST /api/media/review-upload` — unauthenticated, rate-limited (same
  `FORM_RATE_LIMITER` binding already used for review/contact form
  submissions), fixed to the `reviews` R2 category. It reuses the exact
  same file-content verification (magic-byte sniffing, real image
  decode/re-encode, size ceilings) as the existing authenticated upload
  endpoint — only the auth requirement differs.

If your Worker has any allowlist/firewall rule keyed on specific route
paths (e.g. a WAF rule), make sure `/api/media/review-upload` is reachable
the same way `/api/reviews` already is.

---

## 4. Deployment steps

1. **Back up your D1 database** before applying migrations (standard
   practice regardless of how additive they are):
   ```bash
   npx wrangler d1 export icebrim-db --remote --output backup-pre-fix.sql
   ```

2. **Apply the new migrations**:
   ```bash
   cd workers
   npx wrangler d1 migrations apply icebrim-db --remote
   ```

3. **Deploy the Worker** (backend/API):
   ```bash
   cd workers
   npx wrangler deploy
   ```

4. **Build and deploy the frontend**:
   ```bash
   npm install
   npm run build
   # deploy the contents of dist/ to your static host (Cloudflare Pages, etc.)
   ```

5. **Check the coupon data issue** described in Section 2 above.

6. **Smoke-test in production** (see Section 5).

---

## 5. Final verification checklist

Run through this after deploying:

- [ ] **Footer** — shows only real, published products (no "Rotation Twin
      Pack" unless that product genuinely exists and is published)
- [ ] **Checkout** — all customer-detail input fields show a clearly
      visible border in the site's coral theme color
- [ ] **Admin → Pages** — create a new page, confirm it appears at
      `/pages/<slug>`; edit it; unpublish it (confirm it 404s on the
      public site); publish it again; delete it
- [ ] **Admin → Products** — upload a product video on an existing
      product; confirm it appears as a selectable thumbnail (with a film
      icon) on that product's public detail page and plays correctly
- [ ] **Product page → Reviews** — submit a review with 1–2 photos and a
      short video as a logged-out visitor; confirm the submission
      succeeds and shows "pending approval"
- [ ] **Admin → Reviews** — find the pending review from the previous
      step, confirm you can see the uploaded photos and video, approve
      it, and confirm it now displays on the public product page
- [ ] **Admin → Hero/Banner** — set a custom text color, save, confirm it
      applies on the home page hero text
- [ ] **Admin → Coupons** — create a new fixed discount coupon for
      exactly `5`; place a test order using it; confirm exactly £5.00 is
      deducted (not £0.05); create a percentage coupon and confirm it
      still works as before
- [ ] **Admin → Promo Banner** — turn it on with test text, confirm it
      shows above the header on the public site; turn it off, confirm it
      disappears
- [ ] Confirm existing, unrelated flows still work: login, browsing
      products, adding to cart, checkout + payment, order confirmation,
      blog, gallery — this fix pass did not intentionally touch any of
      these, but a full regression pass is worth doing after any
      deployment

---

## 6. Rollback

If anything goes wrong after deployment:

- The Worker can be rolled back to the previous deployment via the
  Cloudflare dashboard or `wrangler rollback`.
- The frontend static build can be rolled back the same way as any
  previous deploy on your host.
- The database migrations are additive (new table, new nullable
  columns) — they do not need to be reversed for a rollback to a
  previous Worker version to work; the old code simply won't read the
  new columns/table. Only reverse them manually if you specifically need
  the schema back to its exact prior shape.
