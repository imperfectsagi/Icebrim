import { useEffect, useRef } from 'react';
import { Minus, Plus, X, ShoppingBag } from 'lucide-react';
import { useCart } from './CartContext';
import { Button } from '@/components/ui/Button';
import { cn, formatPrice } from '@/lib/utils';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function CartDrawer() {
  const { items, subtotal, currency, isOpen, closeCart, updateQuantity, removeItem } = useCart();
  const drawerRef = useRef<HTMLElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // This component stays mounted at all times (isOpen only toggles CSS
  // transform/opacity, so the slide animation has something to animate
  // from/to) -- so focus management here is explicitly guarded on isOpen,
  // unlike AdminModal.tsx which mounts/unmounts and can rely on its
  // effect's cleanup running exactly once per open.
  useEffect(() => {
    if (isOpen) {
      previouslyFocused.current = document.activeElement as HTMLElement | null;
      drawerRef.current?.focus();
    } else {
      previouslyFocused.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeCart();
        return;
      }
      if (e.key !== 'Tab' || !drawerRef.current) return;

      const focusable = Array.from(drawerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
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
  }, [isOpen, closeCart]);

  return (
    <div
      className={cn(
        'fixed inset-0 z-[100] transition-opacity duration-200',
        isOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
      )}
      aria-hidden={!isOpen}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close cart"
        tabIndex={isOpen ? 0 : -1}
        onClick={closeCart}
      />
      <aside
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
        tabIndex={-1}
        className={cn(
          'absolute inset-y-0 right-0 w-full sm:w-[420px] max-w-full bg-white flex flex-col shadow-[var(--shadow-lift)] transition-transform duration-200 focus:outline-none',
          isOpen ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <div className="h-16 shrink-0 flex items-center justify-between px-5 border-b border-[var(--color-line)]">
          <h2 className="font-display text-lg font-medium">Your cart</h2>
          <button
            type="button"
            onClick={closeCart}
            className="inline-flex items-center justify-center h-9 w-9 rounded-full hover:bg-[var(--color-surface-alt)]"
            aria-label="Close cart"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
            <ShoppingBag size={32} className="text-[var(--color-ink-soft)] mb-3" aria-hidden="true" />
            <p className="text-sm text-[var(--color-ink-soft)] mb-4">Your cart is empty.</p>
            <Button variant="secondary" onClick={closeCart} href="/products">
              Browse products
            </Button>
          </div>
        ) : (
          <>
            <ul className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {items.map((item) => (
                <li key={item.productId} className="flex gap-3">
                  <img
                    src={item.image}
                    alt={item.name}
                    loading="lazy"
                    className="h-20 w-20 rounded-lg object-cover shrink-0 bg-[var(--color-surface-alt)]"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-snug line-clamp-2">{item.name}</p>
                      <button
                        type="button"
                        onClick={() => removeItem(item.productId)}
                        className="shrink-0 text-[var(--color-ink-soft)] hover:text-[var(--color-coral-deep)]"
                        aria-label={`Remove ${item.name} from cart`}
                      >
                        <X size={16} aria-hidden="true" />
                      </button>
                    </div>
                    <p className="text-sm text-[var(--color-ink-soft)] mt-0.5">
                      {formatPrice(item.unitPrice, item.currency)}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                        disabled={item.quantity <= 1}
                        className="h-7 w-7 rounded-full border border-[var(--color-line)] flex items-center justify-center disabled:opacity-40"
                        aria-label={`Decrease quantity of ${item.name}`}
                      >
                        <Minus size={13} aria-hidden="true" />
                      </button>
                      <span className="text-sm font-medium w-6 text-center" aria-live="polite">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                        disabled={item.quantity >= item.availableStock}
                        className="h-7 w-7 rounded-full border border-[var(--color-line)] flex items-center justify-center disabled:opacity-40"
                        aria-label={`Increase quantity of ${item.name}`}
                      >
                        <Plus size={13} aria-hidden="true" />
                      </button>
                      {item.quantity >= item.availableStock && (
                        <span className="text-xs text-[var(--color-ink-soft)]">Max stock reached</span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="shrink-0 border-t border-[var(--color-line)] px-5 py-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--color-ink-soft)]">Subtotal</span>
                <span className="font-semibold">{formatPrice(subtotal, currency)}</span>
              </div>
              <p className="text-xs text-[var(--color-ink-soft)]">Shipping and any discounts are calculated at checkout.</p>
              <Button href="/checkout" onClick={closeCart} className="w-full justify-center">
                Checkout
              </Button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
