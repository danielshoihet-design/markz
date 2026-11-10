"use client";

import { useI18n } from "@/lib/i18n/provider";
import type { Locale } from "@/lib/types";

const options: { code: Locale; label: string }[] = [
  { code: "he", label: "עב" },
  { code: "en", label: "EN" },
];

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-line bg-card p-1" aria-label={t.language}>
      {options.map((opt) => (
        <button
          key={opt.code}
          type="button"
          onClick={() => setLocale(opt.code)}
          className={`min-h-9 min-w-10 rounded-full px-2 text-sm font-bold transition ${
            locale === opt.code
              ? "bg-accent text-white"
              : "text-ink-soft hover:bg-cream-deep"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
