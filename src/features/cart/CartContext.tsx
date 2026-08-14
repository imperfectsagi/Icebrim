import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { CartItem } from '@/types/cms';

const STORAGE_KEY = 'icebrim_cart_v1';

interface CartContextValue {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  currency: string;
  /** Adds a product to the cart, or increases quantity if it's already in the cart. Clamps to availableStock. */
  addItem: (item: Omit<CartItem, 'quantity'>, quantity?: number) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  /** Reconciles one item's stock/quantity against a fresh server-reported figure -- see the implementation for when/why this is used. */
  syncStockConflict: (productId: string, availableStock: number) => void;
  clearCart: () => void;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

function loadFromStorage(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Defensive validation -- a malformed or hand-edited localStorage value
    // should degrade to an empty cart, not crash the app on every render.
    return parsed.filter(
      (item): item is CartItem =>
        item && typeof item.productId === 'string' && typeof item.quantity === 'number' && item.quantity > 0,
    );
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => loadFromStorage());
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Storage full or unavailable (private browsing) -- cart still works
      // for the current session via React state, it just won't persist
      // across a reload. Not worth surfacing an error for.
    }
  }, [items]);

  const addItem = useCallback((newItem: Omit<CartItem, 'quantity'>, quantity = 1) => {
    setItems((current) => {
      const existing = current.find((i) => i.productId === newItem.productId);
      if (existing) {
        const nextQuantity = Math.min(existing.quantity + quantity, newItem.availableStock);
        return current.map((i) => (i.productId === newItem.productId ? { ...i, quantity: nextQuantity } : i));
      }
      const clampedQuantity = Math.min(quantity, newItem.availableStock);
      if (clampedQuantity < 1) return current; // out of stock, nothing to add
      return [...current, { ...newItem, quantity: clampedQuantity }];
    });
    setIsOpen(true);
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    setItems((current) => {
      if (quantity <= 0) return current.filter((i) => i.productId !== productId);
      return current.map((i) =>
        i.productId === productId ? { ...i, quantity: Math.min(quantity, i.availableStock) } : i,
      );
    });
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems((current) => current.filter((i) => i.productId !== productId));
  }, []);

  /**
   * Reconciles a single cart item against a fresh stock figure the server
   * just reported (see checkout's 409 response in routes/orders.ts) --
   * used when checkout discovers the cart is stale because stock changed
   * or the product was unpublished since it was added. Removes the item
   * entirely if it's now fully unavailable, otherwise clamps both the
   * stored availableStock and the current quantity so the cart UI
   * immediately reflects reality instead of showing a stepper that still
   * thinks the old (wrong) stock figure is current.
   */
  const syncStockConflict = useCallback((productId: string, availableStock: number) => {
    setItems((current) => {
      if (availableStock <= 0) return current.filter((i) => i.productId !== productId);
      return current.map((i) =>
        i.productId === productId ? { ...i, availableStock, quantity: Math.min(i.quantity, availableStock) } : i,
      );
    });
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const itemCount = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items]);
  const subtotal = useMemo(() => items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0), [items]);
  const currency = items[0]?.currency ?? 'GBP';

  return (
    <CartContext.Provider
      value={{
        items,
        itemCount,
        subtotal,
        currency,
        addItem,
        updateQuantity,
        removeItem,
        syncStockConflict,
        clearCart,
        isOpen,
        openCart: () => setIsOpen(true),
        closeCart: () => setIsOpen(false),
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}
