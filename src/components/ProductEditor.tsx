"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { createClient } from "@/lib/supabase/client";
import { productName, type Product } from "@/lib/types";

export function ProductEditor({ products }: { products: Product[] }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [rows, setRows] = useState(products);
  const [savingId, setSavingId] = useState<string | null>(null);

  function updateRow(id: string, patch: Partial<Product>) {
    setRows((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  async function save(product: Product) {
    setSavingId(product.id);
    const supabase = createClient();
    await supabase
      .from("products")
      .update({
        sell_price: Number(product.sell_price),
        buy_price: Number(product.buy_price),
        active: product.active,
      })
      .eq("id", product.id);
    setSavingId(null);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {rows.map((product) => (
        <article key={product.id} className="card animate-rise overflow-hidden">
          <div className="flex gap-3 p-3">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-cream-deep">
              <Image
                src={product.image_path}
                alt={productName(product, locale)}
                fill
                className="object-cover"
                sizes="80px"
              />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <h3 className="font-display text-lg font-bold leading-tight">
                {productName(product, locale)}
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="field">
                  <label>{t.sellPrice}</label>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={product.sell_price}
                    onChange={(e) =>
                      updateRow(product.id, { sell_price: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="field">
                  <label>{t.buyPrice}</label>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={product.buy_price}
                    onChange={(e) =>
                      updateRow(product.id, { buy_price: Number(e.target.value) })
                    }
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={product.active}
                  onChange={(e) => updateRow(product.id, { active: e.target.checked })}
                />
                {t.active}
              </label>
              <button
                type="button"
                className="btn btn-primary !min-h-10 w-full"
                disabled={savingId === product.id}
                onClick={() => save(product)}
              >
                {t.save}
              </button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
