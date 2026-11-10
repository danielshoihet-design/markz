import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Product } from "@/lib/types";

export function productQtyStep(product: Pick<Product, "unit" | "qty_step">): number {
  const step = Number(product.qty_step);
  if (Number.isFinite(step) && step > 0) return step;
  return product.unit === "unit" ? 1 : 0.5;
}

export function productUnitLabel(
  unit: string,
  t: Pick<Dictionary, "kg" | "unit">,
): string {
  return unit === "unit" ? t.unit : t.kg;
}

export function productPerUnitLabel(
  unit: string,
  t: Pick<Dictionary, "perKg" | "perUnit">,
): string {
  return unit === "unit" ? t.perUnit : t.perKg;
}

export function priceSlashLabel(
  unit: string,
  t: Pick<Dictionary, "kg" | "unit">,
): string {
  return `/${productUnitLabel(unit, t)}`;
}
