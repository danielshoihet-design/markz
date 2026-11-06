"use client";

import { useI18n } from "@/lib/i18n/provider";

export function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const label =
    status === "pending"
      ? t.pending
      : status === "approved"
        ? t.approved
        : status === "fulfilled"
          ? t.fulfilled
          : status === "rejected"
            ? t.rejected
            : status === "accepted"
              ? t.accepted
              : status;

  const tone =
    status === "fulfilled" || status === "accepted" || status === "approved"
      ? "badge-ok"
      : status === "rejected"
        ? "badge-bad"
        : "badge-warn";

  return <span className={`badge ${tone}`}>{label}</span>;
}
