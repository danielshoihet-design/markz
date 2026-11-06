import type { Locale } from "@/lib/types";

export function formatMoney(amount: number, locale: Locale = "en") {
  const loc = locale === "he" ? "he-IL" : locale === "ru" ? "ru-RU" : "en-IL";
  return new Intl.NumberFormat(loc, {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatQty(qty: number, locale: Locale = "en") {
  const loc = locale === "he" ? "he-IL" : locale === "ru" ? "ru-RU" : "en-IL";
  return new Intl.NumberFormat(loc, { maximumFractionDigits: 3 }).format(qty);
}

export function formatDate(iso: string, locale: Locale = "en") {
  const loc = locale === "he" ? "he-IL" : locale === "ru" ? "ru-RU" : "en-IL";
  return new Intl.DateTimeFormat(loc, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}
