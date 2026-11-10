"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { productQtyStep } from "@/lib/product-units";
import type { Product } from "@/lib/types";

export type CartMode = "client" | "seller";

export type CartItem = {
  productId: string;
  slug: string;
  name_he: string;
  name_en: string;
  image_path: string;
  quantity: number;
  unitPrice: number;
  unit: string;
  qty_step: number;
};

type CartContextValue = {
  mode: CartMode;
  items: CartItem[];
  count: number;
  total: number;
  addItem: (product: Product, quantity: number, unitPrice?: number) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  updateUnitPrice: (productId: string, unitPrice: number) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function storageKey(mode: CartMode) {
  return `marketersz-cart-${mode}`;
}

export function CartProvider({
  mode,
  children,
}: {
  mode: CartMode;
  children: React.ReactNode;
}) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(mode));
      if (raw) setItems(JSON.parse(raw) as CartItem[]);
    } catch {
      setItems([]);
    }
    setReady(true);
  }, [mode]);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(storageKey(mode), JSON.stringify(items));
  }, [items, mode, ready]);

  const addItem = useCallback(
    (product: Product, quantity: number, unitPrice?: number) => {
      const price =
        unitPrice ??
        (mode === "client" ? Number(product.sell_price) : Number(product.buy_price));
      const step = productQtyStep(product);
      setItems((prev) => {
        const existing = prev.find((i) => i.productId === product.id);
        if (existing) {
          return prev.map((i) =>
            i.productId === product.id
              ? {
                  ...i,
                  quantity: Math.round((i.quantity + quantity) * 1000) / 1000,
                  unitPrice: price,
                  unit: product.unit || "kg",
                  qty_step: step,
                }
              : i,
          );
        }
        return [
          ...prev,
          {
            productId: product.id,
            slug: product.slug,
            name_he: product.name_he,
            name_en: product.name_en,
            image_path: product.image_path,
            quantity,
            unitPrice: price,
            unit: product.unit || "kg",
            qty_step: step,
          },
        ];
      });
    },
    [mode],
  );

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    setItems((prev) =>
      prev
        .map((i) => (i.productId === productId ? { ...i, quantity } : i))
        .filter((i) => i.quantity > 0),
    );
  }, []);

  const updateUnitPrice = useCallback((productId: string, unitPrice: number) => {
    setItems((prev) =>
      prev.map((i) =>
        i.productId === productId ? { ...i, unitPrice: Math.max(0, unitPrice) } : i,
      ),
    );
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartContextValue>(() => {
    const total = items.reduce(
      (sum, i) => sum + Math.round(i.quantity * i.unitPrice * 100) / 100,
      0,
    );
    const count = items.reduce((sum, i) => sum + 1, 0);
    return {
      mode,
      items,
      count,
      total: Math.round(total * 100) / 100,
      addItem,
      updateQuantity,
      updateUnitPrice,
      removeItem,
      clear,
    };
  }, [mode, items, addItem, updateQuantity, updateUnitPrice, removeItem, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
