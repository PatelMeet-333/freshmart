import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const CartContext = createContext(null);
const KEY = 'fm_cart';
const MAX_QTY = 20;

function load() {
  try {
    const items = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(items) ? items.filter((i) => i && i.id && i.qty > 0) : [];
  } catch {
    return [];
  }
}

const snapshot = (p) => ({ id: p.id, name: p.name, price: p.price, unit: p.unit, image: p.image, category: p.category, stock: p.stock });

export function CartProvider({ children }) {
  const [items, setItems] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch {
      /* storage unavailable: cart still works until the tab closes */
    }
  }, [items]);

  const limitFor = (item) => Math.min(MAX_QTY, item.stock ?? MAX_QTY);

  const add = useCallback((product, qty = 1) => {
    setItems((prev) => {
      const found = prev.find((i) => i.id === product.id);
      if (found) return prev.map((i) => (i.id === product.id ? { ...i, ...snapshot(product), qty: Math.min(limitFor(product), i.qty + qty) } : i));
      return [...prev, { ...snapshot(product), qty: Math.min(limitFor(product), qty) }];
    });
  }, []);

  const setQty = useCallback((id, qty) => {
    setItems((prev) => (qty <= 0 ? prev.filter((i) => i.id !== id) : prev.map((i) => (i.id === id ? { ...i, qty: Math.min(limitFor(i), qty) } : i))));
  }, []);

  const remove = useCallback((id) => setItems((prev) => prev.filter((i) => i.id !== id)), []);
  const clear = useCallback(() => setItems([]), []);

  const value = useMemo(() => {
    const count = items.reduce((s, i) => s + i.qty, 0);
    const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0);
    const qtyOf = (id) => items.find((i) => i.id === id)?.qty ?? 0;
    return { items, count, subtotal, add, setQty, remove, clear, qtyOf };
  }, [items, add, setQty, remove, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  return useContext(CartContext);
}
