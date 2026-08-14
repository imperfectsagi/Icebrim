# FIX-033 — Pre-launch environment and deployment verification checklist

This phase is explicitly infrastructure/configuration, not code -- the
repair plan itself says "Files to Modify: None ... unless gaps are found."
This document is the Step 6 deliverable (a checklist to run through), plus
a record of what was verified at the file level versus what requires the
live Cloudflare account this environment doesn't have access to.

## Verified at the file level (done)

- [x] **`wrangler.toml` `PUBLIC_SITE_URL`** — present, documented with a
  clear comment explaining it must be a comma-separated list including
  every real frontend origin (bare `.pages.dev`, custom domain, `www`
  variant). Currently set to a placeholder `.pages.dev` value with the
  exact multi-domain example shown in a comment for when a custom domain
  is connected.
- [x] **`wrangler.toml` `WORKER_PUBLIC_URL`** — present, documented,
  currently a placeholder Worker URL with instructions on where to find
  the real one (`npx wrangler deploy` output, or the dashboard).
- [x] **All D1 migrations exist and are internally consistent** — all four
  migrations (`0001`–`0004`) were run in sequence against a live SQLite
  engine during this repair (not just eyeballed), including the new
  `orders`/`order_items`/`order_status_history` tables and the exact
  INSERT/UPDATE statements `routes/orders.ts` issues against them. See the
  verification transcript earlier in this session for the actual queries
  run.
- [x] **`DEPLOYMENT.md` reviewed end-to-end** and updated during this
  repair everywhere it had drifted (FIX-006's `.env.production` section,
  FIX-009's admin-bootstrap section, FIX-002's cross-domain cookie
  warning). New sections should be added for the FIX-017/018/021 secrets
  (Stripe, Razorpay, Resend) and the FIX-033 cron trigger -- see "Not yet
  documented" below.
- [x] **`wrangler deploy --dry-run`** — run successfully against the full
  Worker bundle including all Phase 5 e-commerce code, confirming the
  Worker compiles and the `[triggers]` cron config is valid.

## Requires the live Cloudflare account (cannot be completed in this environment)

These are genuine deployment-time steps. No sandboxed environment can
complete them without real account credentials -- doing so isn't a
shortcut that was skipped, it's the actual dependency this phase has.

- [ ] **Confirm `VITE_API_BASE_URL` in the Cloudflare Pages dashboard**
  (Settings → Environment variables → Production) matches the real
  deployed Worker URL, with no trailing slash. This overrides whatever is
  in the committed `.env.production` (see FIX-006) — the file itself is
  no longer authoritative.
- [ ] **Confirm `VITE_SITE_URL`** is also set in the Pages dashboard
  (added by FIX-023 in this repair) to the real production domain.
- [ ] **Set all required secrets via `wrangler secret put`:**
  `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `TURNSTILE_SECRET_KEY` (all
  pre-existing), plus the ones added by this repair:
  `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RAZORPAY_KEY_ID`,
  `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `RESEND_API_KEY`.
  None of these can be placeholder values in production — checkout will
  fail closed (see `lib/payments.ts`) rather than silently succeed if
  they're missing, but that's still a broken storefront until they're set.
- [ ] **Set `VITE_STRIPE_PUBLISHABLE_KEY`** in the Pages dashboard (added
  by this repair, see `.env.example`) — this one is NOT a secret (it's
  meant to be public) but still must be set for the checkout page's card
  step to load Stripe.js correctly.
- [ ] **Run migrations against the remote D1 database**, not just local:
  `npx wrangler d1 migrations apply icebrim-db --remote`. This repo now
  has 4 migrations; confirm all 4 show as applied remotely, not just the
  first 2 (i.e., don't assume a previous deploy already covered
  everything — the new orders/media-category migrations are new).
- [ ] **Map a custom domain for the Worker** if the frontend has a custom
  domain (see FIX-002/FIX-007's cross-domain cookie warning in
  `wrangler.toml`) — this is what actually fixes mobile admin-login
  reliability, not just a nice-to-have.
- [ ] **Configure Stripe and Razorpay webhook endpoints** in each
  provider's dashboard to point at
  `https://<your-worker-domain>/api/webhooks/stripe` and
  `.../api/webhooks/razorpay` respectively, and copy the webhook signing
  secret each dashboard generates into `STRIPE_WEBHOOK_SECRET` /
  `RAZORPAY_WEBHOOK_SECRET`. Orders will never leave "awaiting payment"
  without this even if the payment itself succeeds, since webhook
  delivery is the only thing that marks an order paid (see
  `routes/webhooks.ts`).
- [ ] **Verify a sending domain in Resend** and confirm the `from` address
  in `workers/src/lib/email.ts` (`orders@icebrim.com`) matches a domain
  actually verified there, or order confirmation emails will fail to send
  (non-fatally — see the try/catch around it in `markOrderPaid`).
- [ ] **Full smoke test on the real production URL**, exactly as the
  repair plan's "How to Test" specifies: load the homepage, log into
  admin, upload an image, place one full test order with a real test-mode
  payment card end to end, confirm the order appears in the admin Orders
  panel and product stock decremented by the ordered quantity.

## Not yet documented (recommend adding to DEPLOYMENT.md as a follow-up)

`DEPLOYMENT.md` predates this repair's e-commerce build and does not yet
have a dedicated section walking through the Stripe/Razorpay/Resend secret
setup or the cron trigger. The bullet points above cover what's needed;
promoting them into a proper `DEPLOYMENT.md` §5 "E-commerce setup" section
is recommended as a fast follow, but wasn't done as part of this pass to
avoid growing an already-long document mid-repair without a chance to
review the full document holistically afterward.
