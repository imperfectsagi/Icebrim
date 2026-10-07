import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Container } from '@/components/ui/primitives';
import { Button } from '@/components/ui/Button';
import { SeoHead } from '@/components/common/SeoHead';
import { DeliveryInfo } from '@/components/common/DeliveryInfo';
import { POPUP_COUPON_STORAGE_KEY } from '@/components/common/OfferPopup';
import { usePopupOffer } from '@/hooks/useContent';
import { useCart } from '@/features/cart/CartContext';
import { api, ApiError } from '@/lib/api-client';
import { loadExternalScript } from '@/lib/loadExternalScript';
import { formatPrice, cn } from '@/lib/utils';
import { Lock, ChevronLeft } from 'lucide-react';

const schema = z.object({
  name: z.string().min(2, 'Enter your full name').max(150),
  email: z.string().min(1, 'Enter your email').email('Enter a valid email address'),
  phone: z.string().max(30).optional(),
  line1: z.string().min(1, 'Enter your address'),
  line2: z.string().max(200).optional(),
  city: z.string().min(1, 'Enter your city'),
  postalCode: z.string().min(1, 'Enter your postal code'),
  country: z.string().length(2, 'Select a country'),
  customerNote: z.string().max(500).optional(),
});

type FormValues = z.infer<typeof schema>;

// Small, common subset -- expand as the store's actual shipping zones grow.
// Kept as an explicit allow-list rather than a free-text field so the
// value is always a valid ISO 3166-1 alpha-2 code the backend schema
// accepts (see checkoutCreateSchema / shippingAddressSchema).
const COUNTRIES = [
  { code: 'GB', label: 'United Kingdom' },
  { code: 'IE', label: 'Ireland' },
  { code: 'US', label: 'United States' },
  { code: 'CA', label: 'Canada' },
  { code: 'AU', label: 'Australia' },
  { code: 'IN', label: 'India' },
  { code: 'DE', label: 'Germany' },
  { code: 'FR', label: 'France' },
];

type Step = 'details' | 'paying';

function formatDiscount(coupon: { discountType: 'percentage' | 'fixed'; discountValue: number }): string {
  return coupon.discountType === 'percentage' ? `${coupon.discountValue}% off` : `${formatPrice(coupon.discountValue)} off`;
}

export default function CheckoutPage() {
  const { items, subtotal, currency, clearCart, openCart, syncStockConflict } = useCart();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('details');
  const [paymentProvider, setPaymentProvider] = useState<'stripe' | 'razorpay'>('stripe');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponChecking, setCouponChecking] = useState(false);

  const handleApplyCoupon = async (codeOverride?: string) => {
    // Accepts an explicit code so callers that just set couponInput via
    // setState (which doesn't apply until the next render) -- the popup
    // auto-apply effect and the promo "Apply" button below -- can pass
    // the value directly instead of racing a stale closure over
    // couponInput. The manual Apply button/Enter-key path (which calls
    // this with no argument) is unaffected; it still reads couponInput
    // exactly as before.
    const code = (codeOverride ?? couponInput).trim();
    if (!code) return;
    setCouponChecking(true);
    setCouponError(null);
    try {
      // Server recomputes the subtotal from current product prices and
      // the discount from the coupon row -- this is a preview call, not
      // a frontend calculation (see routes/orders.ts /validate-coupon).
      // The actual discount that gets charged is re-validated again at
      // /checkout below, so a coupon that becomes invalid between these
      // two calls (e.g. it hits its usage limit) is still caught server-side.
      const result = await api.post<{ discount: number; code: string }>('/api/orders/validate-coupon', {
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        couponCode: code,
      });
      setAppliedCoupon(result);
    } catch (err) {
      setAppliedCoupon(null);
      setCouponError(err instanceof ApiError ? err.message : 'Could not validate this coupon. Please try again.');
    } finally {
      setCouponChecking(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput('');
    setCouponError(null);
  };

  // Requirement #4 (checkout coupon offer): the currently configured
  // promotional coupon, resolved the same way the popup resolves it --
  // see usePopupOffer in hooks/useContent.ts and workers/src/routes/
  // admin-content.ts's /popup-offer, which already only ever returns a
  // coupon that is active, not expired, and under its usage limit
  // ("Only show active and valid promotional coupons... do not show
  // expired/inactive"). Reused here rather than a second setting, since
  // both requirement #3 and #4 describe exactly one "currently
  // configured promotional coupon."
  const { data: promoOffer } = usePopupOffer();
  const promoCoupon = appliedCoupon ? null : promoOffer?.coupon ?? null;

  // Requirement #1: "the customer should not need to remember or
  // manually type the coupon code... apply it directly where supported."
  // If the offer popup captured a coupon code earlier in this visit (see
  // OfferPopup.tsx), auto-apply it here through the EXISTING
  // validate-coupon flow the moment checkout loads -- same
  // handleApplyCoupon call a manual "Apply" click makes, just triggered
  // automatically and only once. The customer can still remove it via
  // the existing "Remove" control above.
  useEffect(() => {
    if (appliedCoupon) return;
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(POPUP_COUPON_STORAGE_KEY);
    } catch {
      return;
    }
    if (!stored) return;
    window.localStorage.removeItem(POPUP_COUPON_STORAGE_KEY);
    setCouponInput(stored);
    void handleApplyCoupon(stored);
    // Intentionally run once on mount: this is a one-time "did the
    // customer just come from the popup" check, not something that
    // should re-fire as appliedCoupon/handleApplyCoupon change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { country: 'GB' } });

  if (items.length === 0 && step === 'details') {
    return <Navigate to="/products" replace />;
  }

  const onSubmit = async (values: FormValues) => {
    setSubmitError(null);
    try {
      const response = await api.post<{
        orderId: string;
        orderNumber: string;
        total: number;
        currency: string;
        payment: Record<string, unknown>;
      }>('/api/orders/checkout', {
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        shipping: {
          name: values.name,
          email: values.email,
          phone: values.phone || undefined,
          line1: values.line1,
          line2: values.line2 || undefined,
          city: values.city,
          postalCode: values.postalCode,
          country: values.country,
        },
        customerNote: values.customerNote || undefined,
        paymentProvider,
        couponCode: appliedCoupon?.code,
      });

      setStep('paying');

      if (paymentProvider === 'stripe') {
        await completeStripePayment(
          response,
          { name: values.name, email: values.email },
          clearCart,
          setSubmitError,
          setStep,
        );
      } else {
        await completeRazorpayPayment(
          response,
          { name: values.name, email: values.email, phone: values.phone },
          navigate,
          clearCart,
          setSubmitError,
          setStep,
        );
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // 409 means the server-side stock/availability re-check (see
        // orders.ts checkout handler) found the cart is stale -- an item
        // sold out, had its stock reduced, or was unpublished since it
        // was added. The response includes structured productId +
        // availableStock (not just a message string), so the stale cart
        // item can actually be corrected here, not just described.
        setSubmitError(err.message);
        const body = err.body as { productId?: string; availableStock?: number } | undefined;
        if (body?.productId && typeof body.availableStock === 'number') {
          syncStockConflict(body.productId, body.availableStock);
        }
        openCart();
      } else if (err instanceof ApiError && err.status === 400 && appliedCoupon) {
        // The coupon passed the earlier /validate-coupon preview but was
        // rejected by checkout's own re-validation (e.g. it hit its usage
        // limit in the time between the two calls, or was deactivated).
        // Surface the server's message and drop the now-invalid coupon
        // rather than silently retrying without it.
        setSubmitError(err.message);
        setAppliedCoupon(null);
      } else {
        setSubmitError(
          err instanceof ApiError
            ? err.message
            : 'Something went wrong starting checkout. Please try again.',
        );
      }
      setStep('details');
    }
  };

  return (
    <>
      <SeoHead seo={{ title: 'Checkout — Icebrim', description: 'Complete your order.', canonicalPath: '/checkout' }} />

      <section className="py-10 md:py-14">
        <Container className="max-w-3xl">
          <Link to="/products" className="inline-flex items-center gap-1 text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-coral-deep)] mb-6">
            <ChevronLeft size={16} aria-hidden="true" /> Continue shopping
          </Link>

          <h1 className="font-display text-3xl font-medium mb-8">Checkout</h1>

          <div className="rounded-[var(--radius-card)] border border-[var(--color-line)] p-5 mb-8 space-y-3">
            {items.map((item) => (
              <div key={item.productId} className="flex justify-between text-sm">
                <span className="text-[var(--color-ink-soft)]">
                  {item.name} × {item.quantity}
                </span>
                <span className="font-medium">{formatPrice(item.unitPrice * item.quantity, item.currency)}</span>
              </div>
            ))}
            <div className="pt-3 border-t border-[var(--color-line)] flex justify-between text-sm font-semibold">
              <span>Subtotal</span>
              <span>{formatPrice(subtotal, currency)}</span>
            </div>

            {appliedCoupon ? (
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--color-ink-soft)]">
                  Coupon <span className="font-mono font-medium">{appliedCoupon.code}</span> applied
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[var(--color-coral-deep)]">
                    -{formatPrice(appliedCoupon.discount, currency)}
                  </span>
                  <button
                    type="button"
                    onClick={handleRemoveCoupon}
                    className="text-xs underline text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="form-input flex-1 uppercase"
                    placeholder="Coupon code"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleApplyCoupon();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => handleApplyCoupon()}
                    disabled={couponChecking || !couponInput.trim()}
                    className="px-4 rounded-full text-sm font-medium border border-[var(--color-line)] hover:border-[var(--color-coral)] disabled:opacity-50"
                  >
                    {couponChecking ? 'Checking…' : 'Apply'}
                  </button>
                </div>
                {couponError && (
                  <p role="alert" className="text-xs text-[var(--color-coral-deep)] mt-1.5">
                    {couponError}
                  </p>
                )}
              </div>
            )}

            {/*
              Requirement #4: the currently configured promotional coupon,
              shown directly below the existing coupon input/Apply button
              (unchanged above) without replacing or redesigning it. Only
              rendered when validate-coupon isn't already checking/applied
              and the admin currently has a valid promo coupon configured
              -- "if no promotional coupon is configured, show nothing."
            */}
            {!appliedCoupon && promoCoupon && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-[var(--color-coral)] bg-[var(--color-coral-tint)] px-3 py-2.5 text-sm">
                <span className="text-[var(--color-coral-deep)]">
                  <span className="font-mono font-semibold">{promoCoupon.code}</span> — {formatDiscount(promoCoupon)}
                  {promoCoupon.minOrderSubtotal ? ` on orders over ${formatPrice(promoCoupon.minOrderSubtotal, currency)}` : ''}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setCouponInput(promoCoupon.code);
                    void handleApplyCoupon(promoCoupon.code);
                  }}
                  disabled={couponChecking}
                  className="shrink-0 px-3 py-1 rounded-full text-xs font-semibold bg-[var(--color-coral-deep)] text-white disabled:opacity-50"
                >
                  {couponChecking ? 'Applying…' : 'Apply'}
                </button>
              </div>
            )}

            {appliedCoupon && (
              <div className="pt-3 border-t border-[var(--color-line)] flex justify-between text-sm font-semibold">
                <span>New subtotal</span>
                <span>{formatPrice(Math.max(0, subtotal - appliedCoupon.discount), currency)}</span>
              </div>
            )}

            <p className="text-xs text-[var(--color-ink-soft)]">
              Shipping is calculated at the next step (free over {formatPrice(70, currency)}).
            </p>
          </div>

          <DeliveryInfo className="mb-8" />

          {step === 'paying' ? (
            <div className="text-center py-16">
              <div className="mx-auto mb-4 h-8 w-8 border-2 border-[var(--color-coral)] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-[var(--color-ink-soft)]">Redirecting you to complete payment…</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
              <fieldset className="space-y-4" disabled={isSubmitting}>
                <legend className="font-semibold mb-1">Shipping details</legend>

                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Full name" error={errors.name?.message}>
                    <input className="form-input" {...register('name')} />
                  </Field>
                  <Field label="Email" error={errors.email?.message}>
                    <input type="email" className="form-input" {...register('email')} />
                  </Field>
                </div>

                <Field label="Phone (optional)" error={errors.phone?.message}>
                  <input type="tel" className="form-input" {...register('phone')} />
                </Field>

                <Field label="Address line 1" error={errors.line1?.message}>
                  <input className="form-input" {...register('line1')} />
                </Field>
                <Field label="Address line 2 (optional)" error={errors.line2?.message}>
                  <input className="form-input" {...register('line2')} />
                </Field>

                <div className="grid sm:grid-cols-3 gap-4">
                  <Field label="City" error={errors.city?.message}>
                    <input className="form-input" {...register('city')} />
                  </Field>
                  <Field label="Postal code" error={errors.postalCode?.message}>
                    <input className="form-input" {...register('postalCode')} />
                  </Field>
                  <Field label="Country" error={errors.country?.message}>
                    <select className="form-input" {...register('country')}>
                      {COUNTRIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                <Field label="Order note (optional)" error={errors.customerNote?.message}>
                  <textarea rows={2} className="form-input" {...register('customerNote')} />
                </Field>
              </fieldset>

              <fieldset disabled={isSubmitting}>
                <legend className="font-semibold mb-3">Payment method</legend>
                <div className="grid sm:grid-cols-2 gap-3">
                  <PaymentOption
                    label="Card"
                    description="Visa, Mastercard, Amex via Stripe"
                    selected={paymentProvider === 'stripe'}
                    onClick={() => setPaymentProvider('stripe')}
                  />
                  <PaymentOption
                    label="UPI / Cards (India)"
                    description="UPI, cards, netbanking via Razorpay"
                    selected={paymentProvider === 'razorpay'}
                    onClick={() => setPaymentProvider('razorpay')}
                  />
                </div>
              </fieldset>

              {submitError && (
                <p role="alert" className="text-sm text-[var(--color-coral-deep)]">
                  {submitError}
                </p>
              )}

              <Button type="submit" size="lg" disabled={isSubmitting} className="w-full justify-center">
                <Lock size={16} aria-hidden="true" />
                {isSubmitting
                  ? 'Starting checkout…'
                  : `Pay ${formatPrice(appliedCoupon ? Math.max(0, subtotal - appliedCoupon.discount) : subtotal, currency)}`}
              </Button>
              <p className="text-xs text-center text-[var(--color-ink-soft)]">
                Final total including shipping is confirmed on the next screen before you pay.
              </p>
            </form>
          )}
        </Container>
      </section>

      {/* Scoped .form-input styling for this page's customer-detail fields.
          Uses the site's existing coral theme accent for the border so it's
          clearly visible against the white input background (the shared
          --color-line token used elsewhere is too pale for this purpose on
          a form with this many fields), and reuses the same coral-deep
          error/focus colors already used for field-error text sitewide. */}
      <style>{`
        .form-input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1.5px solid var(--color-coral);
          padding: 0.65rem 0.9rem;
          font-size: 0.95rem;
          background-color: #ffffff;
          color: var(--color-ink);
          color-scheme: light;
        }
        .form-input::placeholder {
          color: var(--color-ink-soft);
          opacity: 1;
        }
        .form-input:hover {
          border-color: var(--color-coral-deep);
        }
        .form-input:focus-visible {
          outline: 2px solid var(--color-coral-deep);
          outline-offset: 2px;
          border-color: var(--color-coral-deep);
        }
      `}</style>
    </>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium mb-1.5">{label}</span>
      {children}
      {error && <span className="block text-xs text-[var(--color-coral-deep)] mt-1">{error}</span>}
    </label>
  );
}

function PaymentOption({
  label,
  description,
  selected,
  onClick,
}: {
  label: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'text-left rounded-[var(--radius-card)] border-2 p-4 transition-colors',
        selected ? 'border-[var(--color-coral)] bg-[var(--color-coral-tint)]' : 'border-[var(--color-line)] hover:border-[var(--color-ice-deep)]',
      )}
    >
      <span className="block font-semibold text-sm">{label}</span>
      <span className="block text-xs text-[var(--color-ink-soft)] mt-0.5">{description}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Payment completion
// ---------------------------------------------------------------------------

/**
 * Loads Stripe.js, mounts it against the client_secret from the checkout
 * response, and redirects to Stripe's hosted confirmation flow. Using
 * `confirmPayment` with automatic redirect (rather than embedding a full
 * Payment Element form inline) keeps this integration simpler and pushes
 * 3D Secure / SCA challenge handling entirely onto Stripe's own hosted UI,
 * which is the path Stripe recommends when a custom inline card form
 * isn't a hard requirement.
 */
async function completeStripePayment(
  order: { orderId: string; orderNumber: string; payment: Record<string, unknown> },
  customer: { name: string; email: string },
  clearCart: () => void,
  setError: (msg: string) => void,
  setStep: (step: Step) => void,
) {
  const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
  if (!publishableKey) {
    setError('Card payment is not configured yet. Please try UPI/Cards (India) or contact us to complete your order.');
    setStep('details');
    return;
  }

  try {
    await loadExternalScript('https://js.stripe.com/v3/');
    // @ts-expect-error -- Stripe.js attaches `Stripe` to window; no bundled types since it's loaded externally by design (see loadExternalScript.ts)
    const stripe = window.Stripe(publishableKey);

    const returnUrl = `${window.location.origin}/order-confirmation?orderNumber=${encodeURIComponent(order.orderNumber)}&email=${encodeURIComponent(customer.email)}`;

    const { error } = await stripe.confirmPayment({
      clientSecret: order.payment.clientSecret as string,
      confirmParams: {
        return_url: returnUrl,
        payment_method_data: { billing_details: { name: customer.name, email: customer.email } },
      },
    });

    if (error) {
      setError(error.message ?? 'Payment failed. Please check your card details and try again.');
      setStep('details');
      return;
    }
    // On success, Stripe redirects the browser to returnUrl itself --
    // execution normally doesn't reach here.
    clearCart();
  } catch {
    setError('Unable to load the payment form. Please check your connection and try again.');
    setStep('details');
  }
}

/**
 * Loads Razorpay's Checkout.js and opens its hosted payment modal
 * (which is where UPI, cards, netbanking, and wallets are all presented
 * -- which methods actually show depends on what's enabled on the
 * Razorpay account, not on anything this frontend controls).
 */
async function completeRazorpayPayment(
  order: { orderId: string; orderNumber: string; payment: Record<string, unknown> },
  customer: { name: string; email: string; phone?: string },
  navigate: ReturnType<typeof useNavigate>,
  clearCart: () => void,
  setError: (msg: string) => void,
  setStep: (step: Step) => void,
) {
  try {
    await loadExternalScript('https://checkout.razorpay.com/v1/checkout.js');

    // @ts-expect-error -- Razorpay attaches itself to window; no bundled types since it's loaded externally by design (see loadExternalScript.ts)
    const razorpay = new window.Razorpay({
      key: order.payment.keyId,
      amount: order.payment.amount,
      currency: order.payment.currency,
      order_id: order.payment.orderId,
      name: 'Icebrim',
      description: `Order ${order.orderNumber}`,
      prefill: { name: customer.name, email: customer.email, contact: customer.phone },
      handler: () => {
        // Razorpay confirmed the payment client-side, but the order is
        // only ACTUALLY marked paid by the signed webhook (see
        // routes/webhooks.ts) -- this redirect is optimistic UI, not the
        // source of truth. The order-status page re-fetches the real
        // status rather than trusting this callback firing at all.
        clearCart();
        navigate(`/order-confirmation?orderNumber=${encodeURIComponent(order.orderNumber)}&email=${encodeURIComponent(customer.email)}`);
      },
      modal: {
        ondismiss: () => {
          setStep('details');
        },
      },
    });

    razorpay.on('payment.failed', () => {
      setError('Payment failed or was cancelled. Please try again.');
      setStep('details');
    });

    razorpay.open();
  } catch {
    setError('Unable to load the payment form. Please check your connection and try again.');
    setStep('details');
  }
}
