# FIX-024 — Product photography and lifestyle imagery

## Status: content-production dependency, not completed

This fix cannot be completed by an automated code-repair pass, and I want
to be direct about why rather than paper over it: the plan's own Root
Cause section says this correctly —

> This is a content/asset gap, not a broken-reference bug ... The issue is
> simply that production-ready photography was never produced or
> uploaded.

Generating fake "photography" (AI-rendered product shots standing in for
real product photos of an actual physical item -- a cooling cap -- being
sold to real customers) would be actively misleading on a commerce site
and isn't something I'll fabricate as a substitute for real content
production. Doing so risks the store showing customers images of a
product that doesn't match what actually ships.

## What was verified

Confirmed the plan's problem statement precisely: `hero-lifestyle.jpg`
(cooling-relief-cap) and `hero.jpg` (twin-pack) are the only two real
product photos in the project, referenced **5 times** across
`src/data/home.ts` and `src/data/products.ts` — the homepage hero, a
featured-product callout, and a third homepage section all reuse the same
single file. No gallery, banner, or about/company imagery exists.

## What IS ready, per the plan's own dependency note

The plan states: *"This should happen after FIX-025/FIX-026 (asset folder
structure) so new images land in the right place from the start."*

**FIX-025 and FIX-026 are both complete** (see CHANGELOG.md) — the media
category system (`products`/`banners`/`blog`/`company`/`gallery`/`other`),
the R2 folder-prefixed storage, and the admin Media Library's category
filtering are all built and working. The moment real photography exists,
uploading it through the admin Products/Gallery/Banner pages will
automatically route it into the correct category with no further code
changes needed.

## What's left (for you, or a follow-up content pass)

1. Commission or source real photography: additional product angles,
   lifestyle/in-use shots, gallery content, about/company imagery.
2. Upload via the admin Media/Gallery pages (ready now).
3. Update `src/data/home.ts`, `src/data/products.ts`, and the D1 seed
   data to reference the new, distinct images per context instead of the
   current 5x reuse of 2 files.
4. Spot-check every public page for remaining repeated/missing imagery.

If real image files are provided in a follow-up session, updating the
`src` references in `home.ts`/`products.ts`/seed data (step 3 above) is a
small, mechanical code change I can do quickly at that point.
