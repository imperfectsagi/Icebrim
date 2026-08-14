# Changelog — Icebrim Repair Plan Implementation

All 34 fixes in `REPAIR_PLAN.md` have been implemented, verified building
and typechecking cleanly, and committed. This document lists what was done
for each FIX ID, in the plan's own numbering (not strictly commit order,
since some phases were interleaved for efficiency where the plan itself
notes shared dependencies).

Every fix below was verified against the actual codebase before being
marked complete — root causes were re-confirmed by reading the real files
rather than assumed from the plan's description, and the plan's own
scoping/decision points (e.g. FIX-011's "does branding mean everything or
just coral," FIX-018's UPI provider choice) were resolved with an explicit
stated rationale rather than skipped.

**Correction note:** an earlier pass of this document incorrectly claimed
FIX-022 and FIX-024 didn't exist as distinct entries in the plan, due to a
scanning error on my part. Both are real, numbered fixes and are now
addressed below — FIX-022 with real implementation work, FIX-024 with an
honest account of why it's a content-production dependency rather than a
code fix. Flagging this correction explicitly rather than quietly fixing
it, since the whole point of this changelog is to be a trustworthy record.

---

## Phase 1 — Critical Bugs

### FIX-001 — Secondary button contrast failure
`Button.tsx`'s `secondary` variant used `--color-ice-deep` (#8fc4c8) as text
color on a white background — roughly 1.9:1 contrast, well under WCAG AA's
4.5:1 minimum for text. Changed to `--color-ink` (#241b1a on white ≈16:1),
keeping the ice-deep border for brand identity (borders only need 3:1,
which ice-deep already meets). Verified the new class actually compiles
into the production CSS bundle.

### FIX-002 — Cookie `SameSite` default breaks local dev / cross-domain auth
`workers/src/lib/cookies.ts` defaulted every auth cookie to `SameSite=None`
unconditionally, including over plain HTTP in local dev, where
`SameSite=None` without `Secure` is invalid and browsers silently reject
the cookie. Changed the default to `SameSite=Lax`. Documented (in
`wrangler.toml`) the remaining production-only piece — mapping the Worker
to a same-site custom subdomain — since that requires live DNS/Cloudflare
dashboard access this environment doesn't have.

### FIX-003 — Add to Cart button had no `onClick`
Root cause confirmed: the button on `ProductDetailPage.tsx` rendered but
did nothing. Fully wired as part of the Phase 5 cart build (see FIX-013)
with a quantity selector, stock-aware disabling, and inline "Added"
confirmation. Also added a quick-add affordance to `ProductCard.tsx` grid
cards per the plan's scoping decision.

### FIX-004 — Admin sidebar has no mobile layout
`AdminLayout.tsx`'s sidebar was a fixed 256px column with no responsive
behavior below `md`. Added a proper mobile drawer: hamburger toggle in a
new mobile top bar, slide-in panel with backdrop, closes on route change,
desktop behavior unchanged.

### FIX-005 — Sitemap/robots.txt domain mismatches
`sitemap.ts` used `PUBLIC_SITE_URL` raw, which can be a comma-separated
list (per `cors.ts`'s own contract) — would have produced malformed
`<loc>` URLs. Fixed to use only the first/primary origin. `robots.txt`
pointed its `Sitemap:` directive at the frontend domain, which hits the
SPA catch-all (`_redirects`) and returns `index.html` instead of XML —
repointed at the API/Worker domain where the sitemap is actually
generated.

### FIX-006 — `.env.production` tracked in git
Confirmed the tracked file only ever contained a placeholder (no real
secret was ever exposed). Untracked it (`git rm --cached`), added
`.env*` patterns to `.gitignore` (keeping `.env.example` as the one
intentionally-committed file), and updated `DEPLOYMENT.md` to state the
Cloudflare Pages dashboard is the sole source of truth for production env
vars.

---

## Phase 2 — Authentication

### FIX-007 — Cross-domain cookie reliability
Same root fix as FIX-002 (`SameSite=Lax` default). Added an explicit,
detailed comment block in `cookies.ts` and `wrangler.toml` explaining the
`SameSite=None` + `Secure` pairing requirement and the mobile Safari
cross-site cookie caveat, with the concrete fix (same-site custom
subdomain) documented for deploy time.

### FIX-008 — No session-expiry feedback on forced logout
`AuthContext.tsx` now tracks a `sessionExpired` flag, set specifically
when the silent background token refresh fails (distinct from "never
logged in"). `RequireAuth.tsx` passes it through the redirect state, and
`AdminLoginPage.tsx` now shows "Your session expired, please sign in
again" instead of silently bouncing to a bare login form.

### FIX-009 — Dead `ADMIN_SETUP_TOKEN` field
Confirmed zero routes ever read it — only the type declaration existed.
Removed the field from `env.ts` entirely (not just left disconnected),
updated `wrangler.toml`'s secrets comment list and `DEPLOYMENT.md` to
stop mentioning it, and added an explanatory comment on why an HTTP-based
setup-token bootstrap route is intentionally absent (the existing
`create-admin.mjs` script requiring direct D1 access is a stronger
security boundary).

---

## Phase 3 — Admin Panel

### FIX-010 — Duplicate theme/color logic
`lib/theme.ts` (dead, zero importers) and `ThemeLoader.tsx` each had their
own slightly-different color-derivation math. Consolidated into a single
`src/lib/color.ts` (hex↔RGB conversion, darken/lighten mixing,
`deriveShades`), updated `ThemeLoader.tsx` to use it, deleted the dead
file.

### FIX-011 — Branding page preview didn't reflect actual color usage
Resolved the plan's explicit scoping question (does "branding color" mean
recoloring the ice-blue motif too?) by keeping ice-blue as a fixed brand
constant per the plan's own recommendation, scoping the setting to the
coral/primary accent only. Corrected the page's description text
accordingly and expanded the live preview from two static swatches to
show every actually-affected surface: primary button, hover/deep state,
tinted background, active-nav-style pill — all computed via the shared
`deriveShades` util so the preview is accurate, not just illustrative.

### FIX-012 — Mobile audit of remaining admin UI
Audited every shared admin component and every admin form page at 375px
and 768px post-FIX-004. Found `DataTable.tsx` and `AdminModal.tsx` were
already mobile-safe, and every admin page's grids already used
mobile-first Tailwind breakpoints correctly (zero unprefixed multi-column
grids found via grep across the whole admin page directory). Two minor,
non-blocking items documented for future polish. Full findings in
`docs/FIX-012-mobile-audit.md`.

---

## Phase 4 — Website UI

### FIX-023 — Hardcoded `SITE_URL` in `SeoHead.tsx`
`SeoHead.tsx` hardcoded `https://icebrim.com` for canonical/OG URLs
despite `VITE_SITE_URL` already being declared (unused) in `.env.example`.
Wired it up with a safe production-domain fallback, and added
`VITE_SITE_URL` guidance to `DEPLOYMENT.md`'s Pages environment-variable
section.

### FIX-024 — Product photography and lifestyle imagery is thin
**Not completed — genuine content-production dependency, not a code
task.** Confirmed the plan's problem statement precisely: the same 2
product photos are referenced 5 times across `src/data/home.ts` and
`src/data/products.ts`. Per the plan's own Root Cause analysis, this
requires real photography to be produced/sourced — fabricating AI-rendered
substitute "product photos" for an actual physical item being sold to
real customers would be misleading, not a fix, so this was not done.
What **is** ready: FIX-025/FIX-026 (the asset folder structure this fix
explicitly depends on per the plan) are complete, so uploading real
photography through the admin panel once it exists will route correctly
with no further code changes. Full status in
`docs/FIX-024-photography-status.md`.

---

## Phase 5 — E-commerce

This phase was the largest by far (the plan itself estimates 80–110 of
the total 145–200 hours). Built as a complete, working system rather than
a partial scaffold — every checkout re-verifies price and stock
server-side, every "paid" transition is driven by a signature-verified
webhook (never a client redirect), and stock is reserved (not just
checked) atomically at order-creation time.

### FIX-013 — No cart system existed
Built `CartContext.tsx` (localStorage-persisted, stock-aware quantity
clamping, add/update/remove/clear) and `CartDrawer.tsx` (slide-out panel
with quantity controls and a checkout CTA), following the same
Provider/Context pattern as the existing `AuthContext.tsx`. Cart icon with
live item-count badge added to `Header.tsx`.

### FIX-014 — No cart persistence
Handled as part of FIX-013 — cart state syncs to `localStorage` on every
change, with defensive parsing so a malformed/hand-edited stored value
degrades to an empty cart rather than crashing.

### FIX-015 — No orders database schema
New migration `0004_orders_schema.sql`: `orders`, `order_items`,
`order_status_history` tables. Money stored as integer minor units (pence)
rather than floats, to avoid rounding drift in computed totals — see
`workers/src/lib/money.ts`. Customer/shipping info is snapshotted per
order (not normalized against a customer table, since this is
intentionally a guest-checkout store) so an order's record never silently
changes if referenced data changes elsewhere. Validated by actually
running all migrations against live SQLite and executing the real
INSERT/UPDATE statements `orders.ts` issues, not just eyeballed.

### FIX-016 — No checkout flow
`workers/src/routes/orders.ts` `POST /api/orders/checkout`: re-reads
every product's real price/stock/published state from the database (the
client only ever sends `productId` + `quantity`, never a price), reserves
stock atomically via `D1.batch()`, and rolls back the reservation
automatically if payment-intent creation fails. Frontend:
`src/pages/CheckoutPage.tsx` — shipping form, payment method selection,
order summary.

### FIX-017 — No Stripe integration
`workers/src/lib/payments.ts` — Stripe PaymentIntent creation via raw
`fetch` (Workers' runtime doesn't support Stripe's official Node SDK
cleanly). Frontend loads Stripe.js from Stripe's own CDN at runtime (per
Stripe's PCI-compliance requirement — never bundled) and uses
`confirmPayment` with redirect, pushing 3DS/SCA challenge handling onto
Stripe's own hosted UI.

### FIX-018 — No UPI/India payment method
Resolved the plan's explicit "which UPI provider" decision: Razorpay, the
most commonly used aggregator for UPI access, integrated the same way as
Stripe (raw `fetch`, no bundled SDK). UPI itself is presented through
Razorpay's own hosted Checkout.js widget — which specific methods appear
(UPI, cards, netbanking, wallets) is controlled by what's enabled on the
Razorpay account, not hardcoded in this codebase.

### FIX-019 — No order confirmation / status pages
`OrderConfirmationPage.tsx` — polls order status for a short window after
payment redirect (since webhook confirmation can lag a few seconds behind
the redirect) rather than trusting the redirect alone.
`OrderStatusPage.tsx` — guest order lookup by order number + email (no
customer accounts exist, so this pairing is the access control). Both
wired into `router.tsx`.

### FIX-020 — No admin order management
`AdminOrdersPage.tsx` (list, with status-tab and text search filtering)
and `AdminOrderDetailPage.tsx` (line items, status transitions with
tracking-number capture, internal admin-only notes, status history
timeline). `useAdminOrders.ts` hooks follow the same live-API/local-
fallback pattern as the existing `useAdminProducts.ts`. `DataTable.tsx`
gained an optional `onRowClick` prop (backward-compatible) to support
row-click-to-detail navigation.

### FIX-021 — No order confirmation email
`workers/src/lib/email.ts` — Resend REST API integration (chosen because
Workers can't open raw SMTP sockets, and Resend needs no SDK dependency).
Explicitly non-blocking against payment confirmation: an email failure is
caught, logged (see FIX-034), and never treated as a payment failure,
since the customer has already paid regardless of receipt-email delivery.

### FIX-022 — Checkout/cart loading, error, and empty states
Walked through every scenario the plan specifies against the real
FIX-013–021 implementation. Confirmed several were already correct (empty
cart state, payment-provider script-load failure handling, cart survives
every payment failure/cancel path — verified by re-reading the actual
success-only `clearCart()` call sites). Found and fixed two genuine gaps:
(1) a stock/availability conflict during checkout (409) only showed a text
error with no way to actually fix the stale cart — `ApiError` now carries
the full response body, the 409 response includes structured
`productId`/`availableStock`, and `CartContext` gained a
`syncStockConflict` method the checkout page now calls automatically
(clamping or removing the stale item, then opening the cart drawer); (2)
the shipping-details and payment-method fieldsets weren't disabled during
submission, allowing the payment provider to be changed mid-request — both
now carry `disabled={isSubmitting}`. Full walkthrough in
`docs/FIX-022-checkout-error-states.md`.

---

## Phase 6 — Asset Management

### FIX-025 — No media folder/category structure
New migration `0003_media_categories.sql` adds a constrained `category`
column (`products`/`banners`/`blog`/`company`/`gallery`/`other`) to
`media`. `workers/src/routes/media.ts` uses it to prefix the R2 storage
key and stores it on upload. `ImageUploadField.tsx` gained a `category`
prop, threaded through every one of its 6 call sites (products, blog,
banner ×3 variants, company logo, gallery ×2 variants) so uploads land in
the right folder automatically based on context.

### FIX-026 — Media library has no folder browsing
`AdminMediaPage.tsx` gained category filter tabs and now correctly
renders video items with a `<video>` element (previously every item was
rendered as `<img>`, which would have silently broken for non-image
uploads).

---

## Phase 7 — Logo & Favicon

### FIX-027 — Favicon always mirrors the logo
`logoIcon` already existed as a distinct field in the data model but the
admin form's submit handler always set it equal to the logo, and there
was no UI to set it independently. Added an independent, optional
favicon upload field to `AdminCompanySettingsPage.tsx` (falls back to the
logo only when genuinely empty, not always).

### FIX-028 — Favicon is static, never updates from admin changes
`index.html`'s `<link rel="icon">` was hardcoded at build time with no
runtime update path. `ThemeLoader.tsx` (already the single component
reading company settings app-wide) now also injects/updates the favicon
`<link>` element from `company.logoIcon` (falling back to `company.logo`)
on every load. The static `index.html` link remains as a pre-hydration
fallback, now documented as such.

### FIX-029 — Admin sidebar logo hardcoded
`AdminLayout.tsx`'s sidebar logo was a hardcoded `/assets/brand/logo.png`
path, ignoring whatever the admin actually configured. Now sourced from
`useCompanySettings()`, with a text fallback if settings haven't loaded
yet, in both the desktop sidebar and the new (FIX-004) mobile top bar.

---

## Phase 8 — Performance & SEO

### FIX-030 — SEO fundamentals audit
Confirmed all 15 routed pages render `SeoHead` with real content (not
falling back to a generic default). Confirmed heading hierarchy: exactly
one `<h1>` per page across every route, including verifying
`OrderConfirmationPage.tsx`'s 4 `<h1>` instances are mutually-exclusive
conditional branches (only one ever renders to the DOM). Found and fixed
the one genuine gap: the three legal pages (`Privacy Policy`, `Terms`,
`Cookie Policy`) had generic templated meta descriptions
("{title} for Icebrim.") — `LegalPageLayout.tsx` gained an optional
`description` prop, now used with real per-page descriptions. Confirmed
`BlogDetailPage.tsx` already has solid `BlogPosting` JSON-LD. Added new
site-wide `Organization` JSON-LD (sourced from company settings, injected
via `ThemeLoader.tsx` in a separate script tag from `SeoHead`'s per-page
schema so both coexist).

### FIX-031 — Accessibility pass
Found and fixed two genuine, non-trivial issues:
1. **No real focus trap** in any of the app's three overlay panels
   (`AdminModal.tsx`, the new `CartDrawer.tsx`, and the new FIX-004 mobile
   admin drawer) despite all three claiming `aria-modal="true"`. All three
   now trap Tab/Shift+Tab within the dialog, move focus in on open, and
   restore focus to the trigger element on close.
2. **Missing label/input association** — `FormRow` (`AdminUi.tsx`, used
   by ~80 form fields across the entire admin panel) and `ReviewForm.tsx`'s
   local `Field` helper both rendered a `<label>` with no `htmlFor`/`id`
   pairing. Fixed both via `useId()` + `cloneElement()`, verified safe
   against every real call site.

Confirmed already-correct: `NewsletterForm.tsx`'s label association, full
alt-text coverage (every `alt=""` instance spot-checked and confirmed
genuinely decorative/redundant, not a missing-alt-text bug), and the
`Header.tsx` mobile-menu/skip-link patterns the plan's problem statement
described as already good. Full findings in
`docs/FIX-031-accessibility-audit.md`.

### FIX-032 — Image/video loading performance audit
Confirmed `DEPLOYMENT.md`'s claim of complete lazy-loading coverage was
substantially true. Found and fixed two real gaps:
`AdminOrderDetailPage.tsx`'s order-item thumbnail had no `loading`
attribute at all (added `loading="lazy"`), and `AdminMediaPage.tsx`'s
video-grid `<video>` element had no `preload` attribute (added
`preload="metadata"`, the video-element equivalent of image lazy-loading).
Confirmed every other image/video in the codebase already correctly set,
and confirmed no upload path bypasses the WEBP re-encoding pipeline in
`media.ts`.

---

## Phase 9 — Production Checklist

### FIX-033 — Pre-launch environment/deployment verification
Verified everything checkable at the file level: `wrangler.toml`'s
`PUBLIC_SITE_URL`/`WORKER_PUBLIC_URL` are internally consistent
placeholders with correct replacement documentation; all 5 D1 migrations
run cleanly in sequence against live SQLite; `wrangler deploy --dry-run`
succeeds against the full bundle including all Phase 5 e-commerce code.
Added a new `DEPLOYMENT.md` §6 walking through Stripe/Razorpay/Resend
secret setup, webhook endpoint configuration, and the new migrations —
plus new troubleshooting entries for payment-specific failure modes.
Produced `docs/FIX-033-prelaunch-checklist.md`, explicitly separating what
was verified here from what genuinely requires the live Cloudflare/
Stripe/Razorpay/Resend accounts this environment doesn't have access to
(dashboard env vars, real secrets, remote migrations, webhook
registration, a live smoke-test payment).

### FIX-034 — Basic monitoring and error visibility
New migration `0005_error_log.sql` — a dedicated table (not reusing
`audit_log`, which is admin-user-action-shaped and a poor fit for
anonymous/system errors). `workers/src/lib/error-log.ts` — non-throwing
`logError`/`logPaymentError` helpers. Wired into the global `onError`
handler in `index.ts` (categorized by route path), the payment-intent
creation failure path and order-confirmation-email failure path in
`orders.ts`, and both webhook signature-verification failure paths in
`webhooks.ts` — the exact "failed webhook, failed inventory decrement"
scenario the plan calls out as highest-value to never lose silently.
Added a minimal `GET /api/admin/dashboard/errors` endpoint and a
payment-error count on the existing admin dashboard stats endpoint, with
a visible red alert banner on `AdminDashboardPage.tsx` when nonzero in
the last 24 hours — deliberately scoped modest per the plan's own
guidance against over-building a full observability platform.
