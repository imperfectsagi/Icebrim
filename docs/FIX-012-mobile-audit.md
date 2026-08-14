# FIX-012 — Admin mobile usability audit (post FIX-004)

Performed after FIX-004 landed (sidebar no longer eats 256px of a narrow
viewport). Walked every admin page and shared admin component at 375px and
768px widths, per the repair plan's Implementation Plan for FIX-012.

## Components already mobile-safe (no action needed)

- **`DataTable.tsx`** — wrapper already has `overflow-x-auto`; wide tables
  scroll horizontally on narrow screens rather than breaking layout. This
  matches the repair plan's suggested minimum bar ("horizontal scroll ...
  instead of a wide table"). A card-based mobile layout would be a nicer
  future upgrade but is not a defect.
- **`AdminModal.tsx`** — backdrop has `p-4` so the dialog never touches the
  screen edge; dialog is `w-full max-w-lg` (fills narrow viewports, caps on
  desktop) with `max-h-[90vh] overflow-y-auto`. Confirmed no keyboard trap:
  Escape closes, backdrop click closes, and there's nothing that prevents
  Tab from reaching the close button.
- **All multi-column admin forms** (`AdminCompanySettingsPage.tsx`,
  `AdminProductFormPage.tsx`, `AdminBlogFormPage.tsx`, `AdminBannerPage.tsx`,
  `AdminAnalyticsPage.tsx`, `AdminDashboardPage.tsx`, `AdminMessagesPage.tsx`,
  `AdminGalleryPage.tsx`, `AdminMediaPage.tsx`) — every grid in every admin
  page already uses Tailwind's mobile-first breakpoint prefixes
  (`sm:grid-cols-2`, `md:grid-cols-5`, etc.), meaning the unprefixed
  (mobile) state is correctly single-column / stacked. Verified by grep
  across `src/features/admin/pages/*.tsx`: zero unprefixed multi-column
  grids exist.

## Minor items found (small enough to fix in one sitting each)

1. **`AdminPageHeader` (`AdminUi.tsx`)** — the title/action row uses
   `flex items-start justify-between gap-4` with no `flex-wrap`. On a very
   narrow screen with both a long page title and an action button, the two
   can feel tight (though `items-start` + a fixed-width button keeps it from
   actually breaking). Low priority: add `flex-wrap` if a specific page
   title proves too long in practice; no page currently has a title long
   enough to trigger this.
2. **Color-picker row in `AdminBrandingPage.tsx`** — the native color input
   (`h-14 w-14`) sits inline with the hex text field via `flex items-center
   gap-4`; on very narrow screens (< 340px) this is snug but does not
   overflow or clip, verified at 320px viewport width (iPhone SE class,
   the narrowest realistic target). No action required.

## Conclusion

No further mobile-layout fixes are required beyond FIX-004 itself. The
codebase's existing Tailwind usage across the admin panel was already
mobile-first and correct; the sidebar was the one genuine gap, and it's
fixed. Item 1 above is tracked for future polish but does not block launch.
