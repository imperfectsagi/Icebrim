const loadedScripts = new Map<string, Promise<void>>();

/**
 * Loads an external <script> exactly once, returning a promise that
 * resolves when it's ready. Used for Stripe.js and Razorpay's
 * Checkout.js -- both must be loaded directly from the provider's own CDN
 * at runtime rather than bundled into the app, which is each provider's
 * explicit integration requirement (Stripe.js in particular ties PCI
 * compliance scope to being loaded fresh from js.stripe.com on every
 * page load, not vendored/cached/bundled).
 */
export function loadExternalScript(src: string): Promise<void> {
  const existing = loadedScripts.get(src);
  if (existing) return existing;

  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });

  loadedScripts.set(src, promise);
  return promise;
}
