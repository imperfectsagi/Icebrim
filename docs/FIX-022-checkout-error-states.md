# FIX-022 — Checkout/cart loading, error, and empty states

Walked through each scenario the plan specifies, against the actual
FIX-013–021 implementation, and fixed genuine gaps found. This fix was
initially missed in the first implementation pass (a numbering-scan error
on my part treated it as absent from the plan) and was corrected once
re-verified against the source document.

## Scenarios checked

1. **Empty cart** — `CartDrawer.tsx` already shows a dedicated empty
   state (icon, message, "Browse products" button) rather than an empty
   list. `CheckoutPage.tsx` redirects to `/products` if reached with an
   empty cart. Already correct, no change needed.

2. **Network failure during checkout submission** — `apiFetch` in
   `api-client.ts` only threw `ApiError` for HTTP error *responses*; a
   genuine network failure (`fetch` itself throwing — offline, DNS
   failure, DevTools "Offline" throttling) produces a raw `TypeError`,
   not an `ApiError`. Confirmed `CheckoutPage.tsx`'s catch block already
   had a non-`ApiError` fallback branch ("Something went wrong starting
   checkout...") so this doesn't hang or crash silently — verified by
   reading the actual catch logic, not assumed.

3. **Payment provider timeout / script load failure** — both
   `completeStripePayment` and `completeRazorpayPayment` wrap their
   external-script-load + provider-SDK calls in try/catch with a clear
   "Unable to load the payment form" message and return to the details
   step. Already correct.

4. **Out-of-stock item discovered mid-checkout — genuine gaps found and fixed:**
   - The 409 response from `POST /api/orders/checkout` only ever
     contained a text `error` message. The cart itself was never
     corrected, so resubmitting without manually opening the cart and
     fixing the quantity would just fail again with the same error.
     **Fixed:** the 409 response now also includes structured
     `productId` + `availableStock`. `CartContext` gained a
     `syncStockConflict(productId, availableStock)` method that clamps
     the stale item's quantity (or removes it entirely if now fully
     unavailable) using this data. `CheckoutPage.tsx`'s catch block calls
     it and opens the cart drawer automatically, so the customer sees
     exactly what changed instead of reading an error with no obvious
     next step.
   - `ApiError` only carried `message`/`status`, with no way to read
     structured fields from an error response body. Extended it with a
     `body: unknown` field carrying the full parsed JSON error response.

5. **Double-submission / mid-request UI state** — `isSubmitting` from
   `react-hook-form` already disabled the submit button during the
   request. **Gap found:** the shipping-details and payment-method
   `<fieldset>` elements were not disabled during submission, so a
   customer could change the selected payment provider (or edit shipping
   fields) while a request was already in flight. **Fixed:** both
   fieldsets now carry `disabled={isSubmitting}` — HTML fieldsets
   automatically disable every descendant form control, so this required
   no changes to the individual `PaymentOption` buttons or input fields
   themselves.

6. **Cart clearing on payment failure (repair plan Step 3, explicitly
   called out)** — verified by re-reading both payment-completion
   functions line by line: `clearCart()` is only ever called on the
   genuine success path in both Stripe (after `confirmPayment` returns
   with no `error`) and Razorpay (inside the `handler` callback, which
   Razorpay only invokes on confirmed payment). Every failure/cancel/
   dismiss path (`error` from Stripe, `payment.failed` event from
   Razorpay, modal `ondismiss`) returns to the details step without
   touching the cart. Already correct — confirmed, not assumed.

## Result

The checkout flow now degrades correctly under the scenarios the plan
specifies: network failures show a clear message without hanging, stale
stock is corrected in the cart itself (not just described in an error),
the cart survives every failure path, and the form can't be tampered with
mid-submission.
