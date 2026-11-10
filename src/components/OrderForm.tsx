"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { QuantityStepper } from "@/components/QuantityStepper";
import { useCart } from "@/lib/cart/store";
import { useI18n } from "@/lib/i18n/provider";
import { formatMoney } from "@/lib/format";
import {
  productPerUnitLabel,
  productQtyStep,
  productUnitLabel,
} from "@/lib/product-units";
import { productName, type Product } from "@/lib/types";

export function OrderForm({ product }: { product: Product }) {
  const { t, locale } = useI18n();
  const cart = useCart();
  const router = useRouter();
  const step = productQtyStep(product);
  const [qty, setQty] = useState(step);
  const [added, setAdded] = useState(false);

  const total = useMemo(
    () => Math.round(qty * Number(product.sell_price) * 100) / 100,
    [qty, product.sell_price],
  );

  function addToCart() {
    cart.addItem(product, qty);
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
          <p className="text-lg font-bold text-accent">
            {formatMoney(Number(product.sell_price), locale)}{" "}
            <span className="text-sm font-semibold text-ink-soft">
              {productPerUnitLabel(product.unit, t)}
            </span>
          </p>
        </div>
      </div>

      <QuantityStepper
        value={qty}
        onChange={setQty}
        step={step}
        unitLabel={productUnitLabel(product.unit, t)}
      />

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
        onClick={() => router.push("/client/cart")}
      >
        {t.cart} ({cart.count})
      </button>
    </div>
  );
}
