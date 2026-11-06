"use client";

import { useI18n } from "@/lib/i18n/provider";
import { formatMoney } from "@/lib/format";

type CreditClient = {
  id: string;
  full_name: string;
  credit_balance: number;
};

export function DailySummary({
  monthSales,
  monthCredit,
  monthSupplierSpend,
  creditClients,
}: {
  monthSales: number;
  monthCredit: number;
  monthSupplierSpend: number;
  creditClients: CreditClient[];
}) {
  const { t, locale } = useI18n();

  return (
    <section className="animate-pop mb-5 space-y-3">
      <h2 className="font-display text-xl font-bold">{t.dailySummary}</h2>
      <div className="grid grid-cols-1 gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="card p-4">
            <p className="text-xs font-semibold text-ink-soft">{t.monthSales}</p>
            <p className="font-display text-2xl font-bold text-ok">
              {formatMoney(monthSales, locale)}
            </p>
          </div>
          <div className="card p-4">
            <p className="text-xs font-semibold text-ink-soft">{t.monthCredit}</p>
            <p className="font-display text-2xl font-bold text-accent">
              {formatMoney(monthCredit, locale)}
            </p>
          </div>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold text-ink-soft">{t.monthSupplierSpend}</p>
          <p className="font-display text-2xl font-bold text-bad">
            {formatMoney(monthSupplierSpend, locale)}
          </p>
        </div>
      </div>

      <div className="card space-y-2 p-4">
        <h3 className="font-display text-lg font-bold">{t.clientsOnCredit}</h3>
        {creditClients.length === 0 ? (
          <p className="text-sm text-ink-soft">{t.noCreditClients}</p>
        ) : (
          <ul className="space-y-2">
            {creditClients.map((client) => (
              <li
                key={client.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-cream px-3 py-2"
              >
                <span className="font-semibold">{client.full_name}</span>
                <span className="font-bold text-accent">
                  {formatMoney(Number(client.credit_balance), locale)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
