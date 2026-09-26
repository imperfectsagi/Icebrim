import { useEffect, useRef, useState } from 'react';
import { Check, Copy, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { usePopupOffer, submitPopupOfferEmail } from '@/hooks/useContent';
import { ApiError } from '@/lib/api-client';
import { formatPrice } from '@/lib/utils';

const DISMISSED_KEY = 'icebrim_popup_offer_dismissed';
// Read by CheckoutPage.tsx to prefill + auto-apply the coupon the popup
// showed, using the site's EXISTING checkout coupon input/Apply flow (see
// CheckoutPage.tsx's handleApplyCoupon) -- this key is just how the
// coupon code crosses from this component to that page; it never bypasses
// or duplicates the actual validation/apply logic, which still always
// happens through /api/orders/validate-coupon exactly as it does for a
// manually typed code.
export const POPUP_COUPON_STORAGE_KEY = 'icebrim_popup_offer_coupon';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

type Stage = 'form' | 'offer';

function formatDiscount(coupon: { discountType: 'percentage' | 'fixed'; discountValue: number }): string {
  return coupon.discountType === 'percentage' ? `${coupon.discountValue}% off` : `${formatPrice(coupon.discountValue)} off`;
}

/**
 * Site-wide promotional popup shown on load (requirement #1). Collects
 * an email, then reveals the admin-selected EXISTING coupon (never a
 * second/parallel coupon system -- see AdminPopupPage.tsx and
 * workers/src/routes/admin-content.ts's /popup-offer endpoints, which
 * only ever resolve a coupon id already living in the real coupons
 * table). Renders nothing if the admin has it disabled, if there's
 * currently no valid coupon configured for it to show, or if this
 * visitor has already dismissed/submitted it this browsing session (see
 * DISMISSED_KEY -- same "don't nag every page load" localStorage pattern
 * already used by CookieConsent.tsx).
 */
export function OfferPopup() {
  const { data, isLoading } = usePopupOffer();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(true); // default hidden until the localStorage check below confirms it's safe to show
  const [stage, setStage] = useState<Stage>('form');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [revealedCode, setRevealedCode] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(DISMISSED_KEY) === '1');
    } catch {
      // localStorage unavailable -- fail open (don't show) rather than
      // risk re-showing on every single navigation for these visitors.
      setDismissed(true);
    }
  }, []);

  const visible = !isLoading && !dismissed && !!data?.enabled && !!data.coupon;

  const close = () => {
    try {
      window.localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // ignore persistence failure; popup will simply reappear next visit
    }
    setDismissed(true);
  };

  // Focus trap + Escape-to-close + focus restore, same pattern as
  // AdminModal.tsx and AdminLayout.tsx's mobile drawer, applied here
  // since this is a real modal dialog on the public site.
  useEffect(() => {
    if (!visible) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => {
      previouslyFocused.current?.focus();
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [visible]);

  if (!visible || !data?.coupon) return null;
  const coupon = data.coupon;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await submitPopupOfferEmail(email.trim());
      // Use the code the server actually snapshotted at submit time
      // (result.couponCode) rather than assuming it still matches what
      // was displayed a moment ago -- the admin could have changed the
      // popup's linked coupon in the seconds between page load and
      // submit. Falls back to the on-screen coupon if the server
      // snapshotted the same one (the common case).
      const code = result.couponCode ?? coupon.code;
      setRevealedCode(code);
      try {
        window.localStorage.setItem(POPUP_COUPON_STORAGE_KEY, code);
        window.localStorage.setItem(DISMISSED_KEY, '1');
      } catch {
        // ignore persistence failure -- the coupon is still shown/copyable below for this page view
      }
      setStage('offer');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = async () => {
    const code = revealedCode ?? coupon.code;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (permissions, older browser) -- the
      // code is still shown as plain selectable text, so the customer
      // can still copy it manually.
    }
  };

  const handleApplyAtCheckout = () => {
    close();
    navigate('/checkout');
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50" onClick={close} role="presentation">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={data.heading || 'Special offer'}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-[var(--radius-card)] bg-white border border-[var(--color-line)] shadow-[var(--shadow-lift)] p-6 sm:p-8 focus:outline-none"
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-[var(--color-surface-alt)] text-[var(--color-ink-soft)]"
        >
          <X size={18} aria-hidden="true" />
        </button>

        {stage === 'form' ? (
          <>
            {data.heading && (
              <h2 className="font-display text-2xl font-medium mb-2 pr-6 text-balance">{data.heading}</h2>
            )}
            {data.subheading && <p className="text-sm text-[var(--color-ink-soft)] mb-6">{data.subheading}</p>}

            <form onSubmit={handleSubmit} noValidate className="space-y-3">
              <label className="block">
                <span className="sr-only">Email address</span>
                <input
                  type="email"
                  required
                  autoFocus
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-[var(--color-line)] px-4 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-[var(--color-coral-deep)]"
                  style={{ colorScheme: 'light' }}
                  aria-invalid={!!error}
                  aria-describedby={error ? 'popup-offer-error' : undefined}
                />
              </label>
              {error && (
                <p id="popup-offer-error" role="alert" className="text-xs text-[var(--color-coral-deep)]">
                  {error}
                </p>
              )}
              <div className="flex items-center gap-3 pt-1">
                <Button type="submit" disabled={submitting || !email.trim()} className="flex-1 justify-center">
                  {submitting ? 'Submitting…' : 'Get my offer'}
                </Button>
                <button
                  type="button"
                  onClick={close}
                  className="text-sm font-medium text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
                >
                  No thanks
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-[var(--color-coral-tint)] flex items-center justify-center">
              <Check size={22} className="text-[var(--color-coral-deep)]" aria-hidden="true" />
            </div>
            <h2 className="font-display text-xl font-medium mb-1">You're in!</h2>
            <p className="text-sm text-[var(--color-ink-soft)] mb-5">
              {formatDiscount(coupon)}
              {coupon.minOrderSubtotal ? ` on orders over ${formatPrice(coupon.minOrderSubtotal)}` : ''} -- use the code
              below at checkout.
            </p>

            <button
              type="button"
              onClick={handleCopy}
              className="w-full flex items-center justify-between gap-3 rounded-xl border-2 border-dashed border-[var(--color-coral)] bg-[var(--color-coral-tint)] px-4 py-3 mb-4"
              aria-label={`Copy coupon code ${revealedCode ?? coupon.code}`}
            >
              <span className="font-mono text-lg font-semibold tracking-wide text-[var(--color-coral-deep)]">
                {revealedCode ?? coupon.code}
              </span>
              <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-coral-deep)] shrink-0">
                {copied ? (
                  <>
                    <Check size={14} aria-hidden="true" /> Copied
                  </>
                ) : (
                  <>
                    <Copy size={14} aria-hidden="true" /> Copy
                  </>
                )}
              </span>
            </button>

            <Button onClick={handleApplyAtCheckout} className="w-full justify-center mb-3">
              Shop now
            </Button>
            <button
              type="button"
              onClick={close}
              className="text-sm font-medium text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
            >
              I'll use this later
            </button>
          </div>
        )}

        {stage === 'form' && (
          <p className="mt-5 text-[11px] leading-relaxed text-[var(--color-ink-soft)]">
            By submitting, you agree to receive marketing emails. See our{' '}
            <Link to="/privacy-policy" className="underline hover:text-[var(--color-ink)]" onClick={close}>
              Privacy Policy
            </Link>
            .
          </p>
        )}
      </div>
    </div>
  );
}
