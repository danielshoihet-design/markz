"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { QuantityStepper } from "@/components/QuantityStepper";
import { useCart } from "@/lib/cart/store";
import { useI18n } from "@/lib/i18n/provider";
import { formatMoney } from "@/lib/format";
import {
  productPerUnitLabel,
  productQtyStep,
  productUnitLabel,
} from "@/lib/product-units";
import { createClient } from "@/lib/supabase/client";
import type { Locale } from "@/lib/types";

function itemName(
  item: { name_he: string; name_en: string; name_ru: string },
  locale: Locale,
) {
  if (locale === "he") return item.name_he;
  if (locale === "ru") return item.name_ru;
  return item.name_en;
}

export function CartView({ mode }: { mode: "client" | "seller" }) {
  const { t, locale } = useI18n();
  const cart = useCart();
  const router = useRouter();
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  async function checkout() {
    if (cart.items.length === 0) return;
    setLoading(true);
    setError("");
    setOk("");
    const supabase = createClient();
    const items = cart.items.map((i) =>
      mode === "client"
        ? { product_id: i.productId, quantity: i.quantity }
        : {
            product_id: i.productId,
            quantity: i.quantity,
            unit_price: i.unitPrice,
          },
    );
    const { error: rpcError } =
      mode === "client"
        ? await supabase.rpc("place_order", {
            p_items: items,
            p_note: note || null,
          })
        : await supabase.rpc("place_supply", {
            p_items: items,
            p_note: note || null,
          });

    if (rpcError) {
      setError(rpcError.message);
      setLoading(false);
      return;
    }

    cart.clear();
    setOk(mode === "client" ? t.orderSent : t.supplySent);
    setLoading(false);
    router.push(mode === "client" ? "/client/orders" : "/seller/supplies");
    router.refresh();
  }

  if (cart.items.length === 0) {
    return <div className="card p-6 text-center text-ink-soft">{t.cartEmpty}</div>;
  }

  return (
    <div className="space-y-4">
      {cart.items.map((item) => (
        <article key={item.productId} className="card animate-rise space-y-3 p-3">
          <div className="flex gap-3">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-cream-deep">
              <Image
                src={item.image_path}
                alt={itemName(item, locale)}
                fill
                className="object-cover"
                sizes="80px"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-display text-lg font-bold leading-tight">
                  {itemName(item, locale)}
                </h3>
                <button
                  type="button"
                  className="text-sm font-bold text-bad"
                  onClick={() => cart.removeItem(item.productId)}
                >
                  {t.remove}
                </button>
              </div>
              <p className="text-sm font-semibold text-accent">
                {formatMoney(item.unitPrice, locale)}{" "}
                {productPerUnitLabel(item.unit || "kg", t)}
              </p>
            </div>
          </div>

          <QuantityStepper
            value={item.quantity}
            onChange={(qty) => cart.updateQuantity(item.productId, qty)}
            step={productQtyStep({
              unit: item.unit || "kg",
              qty_step: item.qty_step ?? 0.5,
            })}
            unitLabel={productUnitLabel(item.unit || "kg", t)}
          />

          {mode === "seller" ? (
            <div className="field">
              <label>
                {t.price} (₪/{productUnitLabel(item.unit || "kg", t)})
              </label>
              <input
                type="number"
                min={0}
                step={0.5}
                value={item.unitPrice}
                onChange={(e) =>
                  cart.updateUnitPrice(item.productId, Number(e.target.value))
                }
              />
            </div>
          ) : null}

          <div className="flex justify-between text-sm font-bold">
            <span>{t.total}</span>
            <span>
              {formatMoney(
                Math.round(item.quantity * item.unitPrice * 100) / 100,
                locale,
              )}
            </span>
          </div>
        </article>
      ))}

      <div className="card flex items-center justify-between p-4">
        <span className="font-semibold text-ink-soft">{t.total}</span>
        <span className="font-display text-2xl font-bold">
          {formatMoney(cart.total, locale)}
        </span>
      </div>

      <div className="field">
        <label htmlFor="cart-note">
          {t.note} ({t.optional})
        </label>
        <textarea
          id="cart-note"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      {error ? <p className="text-sm font-semibold text-bad">{error}</p> : null}
      {ok ? <p className="text-sm font-semibold text-ok">{ok}</p> : null}

      <button
        type="button"
        className="btn btn-primary w-full"
        disabled={loading}
        onClick={checkout}
      >
        {loading ? t.ordering : mode === "client" ? t.checkout : t.sendSupply}
      </button>
    </div>
  );
}
