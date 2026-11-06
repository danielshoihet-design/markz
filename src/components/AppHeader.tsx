"use client";

import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/lib/i18n/provider";
import { formatMoney } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type Props = {
  title: string;
  subtitle?: string;
  balance?: number | null;
  showLogout?: boolean;
};

export function AppHeader({ title, subtitle, balance, showLogout = true }: Props) {
  const { t, locale } = useI18n();
  const router = useRouter();

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-[rgba(251,246,238,0.9)] px-4 pb-3 pt-[max(0.9rem,env(safe-area-inset-top))] backdrop-blur-md">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-sm font-bold tracking-[0.18em] text-accent uppercase">
            {t.brand}
          </p>
          <h1 className="font-display text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle ? <p className="mt-0.5 text-sm text-ink-soft">{subtitle}</p> : null}
        </div>
        <LanguageSwitcher />
      </div>
      <div className="flex items-center justify-between gap-3">
        {typeof balance === "number" ? (
          <div className={`badge text-sm ${balance > 0 ? "badge-warn" : "badge-ok"}`}>
            {t.balance}: {formatMoney(balance, locale)}
          </div>
        ) : (
          <div />
        )}
        {showLogout ? (
          <button type="button" className="btn btn-ghost !min-h-9 !px-3 text-sm" onClick={logout}>
            {t.logout}
          </button>
        ) : null}
      </div>
    </header>
  );
}
