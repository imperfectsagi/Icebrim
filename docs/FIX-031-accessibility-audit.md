# FIX-031 — Accessibility audit

Performed per the repair plan's steps: automated-style review (manual
equivalent of an axe/Lighthouse pass across code, since no browser is
available in this environment) + manual reasoning through keyboard focus
order across every overlay panel, plus a full-codebase grep for label
association and alt-text coverage.

## Fixed

1. **No real focus trap in any overlay panel** (`AdminModal.tsx`,
   `CartDrawer.tsx`, and the mobile drawer in `AdminLayout.tsx` added this
   session for FIX-004). All three had `role="dialog" aria-modal="true"`
   but nothing actually stopped Tab from moving focus to page content
   hidden behind the backdrop -- a real focus trap, keyboard-only user
   testing would have caught immediately. Fixed all three consistently:
   focus moves into the dialog on open, Tab/Shift+Tab now wraps at the
   dialog's first/last focusable element instead of escaping, and focus
   returns to whatever triggered the dialog on close (so keyboard users
   land back where they were, not reset to `<body>`).

2. **`FormRow` (`AdminUi.tsx`) and `ReviewForm.tsx`'s local `Field` helper
   both rendered a `<label>` with no `htmlFor`, and never passed an `id`
   to the wrapped input.** Association was visual/positional only --
   clicking the label text didn't focus the field, and screen readers
   could not reliably announce which label belongs to which input on
   focus. `FormRow` alone is used by ~80 form fields across the entire
   admin panel (every settings, product, blog, category, banner, and
   order-management form), so this was a systemic, not cosmetic, gap.
   Fixed both with `useId()` + `cloneElement()` to inject a real
   `id`/`aria-invalid`/`aria-describedby` onto the child input, verified
   safe against every actual call site (confirmed by an automated scan
   plus manual sampling across 6+ files -- every usage passes exactly one
   element child; the two ternary-based gallery upload fields each render
   exactly one `<ImageUploadField>` at a time, never both).

## Confirmed already correct (no action needed)

- `NewsletterForm.tsx` already has proper `htmlFor`/`id`, `aria-invalid`,
  and `aria-describedby` -- a good reference example, consistent with
  what FIX-031's problem statement predicted for public-facing components.
- Alt text audit: every `<img>` in the codebase has an explicit `alt`.
  Spot-checked every instance of `alt=""` specifically (`HeroBanner.tsx`,
  `AdminProductsPage.tsx`, `AdminOrderDetailPage.tsx`) and confirmed each
  is genuinely decorative/redundant -- paired with visible adjacent text
  (product name next to a thumbnail) or marked `role="presentation"` for
  a pure background image -- not a case of missing real alt text.
- `Header.tsx`/`Footer.tsx` mobile menu toggle already has
  `aria-label`/`aria-expanded`, `:focus-visible` styling exists in
  `index.css`, and the "skip to main content" link works correctly --
  confirmed as the plan's problem statement described.

## Not addressed (out of scope for this pass)

- `ImageUploadField.tsx` (custom file-upload widget) doesn't accept an
  `id` prop, so `FormRow`'s injected `id` is a harmless no-op when it
  wraps that component (two call sites in `AdminGalleryPage.tsx`). This
  is a pre-existing limitation, not a regression introduced by this fix --
  the widget has no single input to label in the traditional sense. Worth
  a small follow-up (accept and forward an `id` to its internal file
  input) but low priority since the widget has its own internal labeling.
