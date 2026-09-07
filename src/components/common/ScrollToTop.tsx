import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Resets the window scroll position to the top whenever the route's
 * pathname changes, so navigating to a new page (via nav links, footer
 * links, or programmatic navigation) always opens at the top instead of
 * preserving the previous page's scroll position -- browsers don't do
 * this automatically for client-side route changes the way they do for
 * full page loads.
 *
 * Deliberately keyed on `pathname` (not the full location, which also
 * includes `search`/`hash`) so that:
 *   - changing only query params on the same page (e.g. a filter) doesn't
 *     yank the user back to the top mid-interaction, and
 *   - in-page hash anchors (e.g. the header's "Skip to main content"
 *     link) aren't fought by this effect.
 *
 * Uses `behavior: 'instant'` rather than the site's global CSS
 * `scroll-behavior: smooth` (see index.css) so the jump to the top of a
 * new page is immediate, not an animated scroll -- matching how normal
 * full-page navigation behaves.
 *
 * Rendered once inside the public site's Layout and once inside the
 * admin panel's AdminApp, so it covers both the public site (react-router
 * data router) and the admin panel (react-router <Routes>) without any
 * shared router configuration between the two.
 */
export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);

  return null;
}
