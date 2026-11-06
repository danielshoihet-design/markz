"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { QuantityStepper } from "@/components/QuantityStepper";
import { useCart } from "@/lib/cart/store";
import { useI18n } from "@/lib/i18n/provider";
import { formatMoney } from "@/lib/format";
import { productName, type Product } from "@/lib/types";

export function SupplyForm({ product }: { product: Product }) {
  const { t, locale } = useI18n();
  const cart = useCart();
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [unitPrice, setUnitPrice] = useState(Number(product.buy_price));
  const [added, setAdded] = useState(false);

  const total = useMemo(
    () => Math.round(qty * unitPrice * 100) / 100,
    [qty, unitPrice],
  );

  function addToCart() {
    cart.addItem(product, qty, unitPrice);
    setAdded(true);
  }

  return (
    <div className="animate-pop space-y-4">
      <div className="card overflow-hidden">
        <div className="relative aspect-[4/3] bg-cream-deep">
          <Image
            src={product.image_path}
            alt={productName(product, locale)}
            fill
            className="object-cover"
            sizes="480px"
            priority
          />
        </div>
        <div className="space-y-1 p-4">
          <h2 className="font-display text-3xl font-bold">{productName(product, locale)}</h2>
          <p className="text-sm text-ink-soft">{t.buyPrice}</p>
        </div>
      </div>

      <QuantityStepper value={qty} onChange={setQty} unitLabel={t.kg} />

      <div className="field">
        <label htmlFor="unitPrice">{t.price} (₪/{t.kg})</label>
        <input
          id="unitPrice"
          type="number"
          min={0}
          step={0.5}
          value={unitPrice}
          onChange={(e) => setUnitPrice(Number(e.target.value))}
        />
      </div>

      <div className="card flex items-center justify-between p-4">
        <span className="font-semibold text-ink-soft">{t.total}</span>
        <span className="font-display text-2xl font-bold">{formatMoney(total, locale)}</span>
      </div>

      {added ? (
        <p className="text-center text-sm font-semibold text-ok">{t.addedToCart}</p>
      ) : null}

      <button type="button" className="btn btn-primary w-full" onClick={addToCart}>
        {t.addToCart}
      </button>
      <button
        type="button"
        className="btn btn-secondary w-full"
        onClick={() => router.push("/seller/cart")}
      >
        {t.cart} ({cart.count})
      </button>
    </div>
  );
}
