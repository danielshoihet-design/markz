"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";

export function MonthPicker({ value }: { value: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <div className="field mb-4">
      <label htmlFor="month">{t.month}</label>
      <input
        id="month"
        type="month"
        value={value}
        onChange={(e) => {
          const params = new URLSearchParams(searchParams.toString());
          params.set("month", e.target.value);
          router.push(`/manager/report?${params.toString()}`);
        }}
      />
    </div>
  );
}
