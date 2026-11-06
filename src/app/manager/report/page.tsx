import { Suspense } from "react";
import { MonthPicker } from "@/components/MonthPicker";
import { RoleShell } from "@/components/RoleShell";
import { requireRole } from "@/lib/auth";
import { formatMoney, formatQty } from "@/lib/format";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { productName, type Product } from "@/lib/types";

function monthBounds(month: string) {
  const [y, m] = month.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  return { start: start.toISOString(), end: end.toISOString() };
}

export default async function ManagerReportPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { supabase, profile } = await requireRole(["manager"]);
  const t = getDictionary(profile.locale);
  const params = await searchParams;
  const now = new Date();
  const month =
    params.month ||
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const { start, end } = monthBounds(month);

  const [{ data: orders }, { data: supplies }, { data: ledger }] = await Promise.all([
    supabase
      .from("orders")
      .select("total, status, amount_paid, payment_status, order_items(quantity, product_id, products(*))")
      .neq("status", "rejected")
      .gte("created_at", start)
      .lt("created_at", end),
    supabase
      .from("supplies")
      .select("total, amount_paid, status, profiles!seller_id(full_name)")
      .eq("status", "accepted")
      .gte("created_at", start)
      .lt("created_at", end),
    supabase
      .from("credit_ledger")
      .select("amount")
      .gte("created_at", start)
      .lt("created_at", end),
  ]);

  const sales = (orders || []).reduce((sum, o) => sum + Number(o.total), 0);
  const collected = (orders || []).reduce(
    (sum, o) => sum + Number(o.amount_paid || 0),
    0,
  );
  const openCredit = (orders || []).reduce((sum, o) => {
    if (!o.payment_status) return sum;
    return sum + Math.max(0, Number(o.total) - Number(o.amount_paid || 0));
  }, 0);
  const purchases = (supplies || []).reduce(
    (sum, s) => sum + Number(s.amount_paid || s.total || 0),
    0,
  );
  const margin = sales - purchases;
  const creditsOutstanding = (ledger || [])
    .reduce((sum, l) => sum + Number(l.amount), 0);

  const supplierMap = new Map<string, number>();
  for (const supply of supplies || []) {
    const profileRel = supply.profiles as { full_name?: string } | { full_name?: string }[] | null;
    const name = Array.isArray(profileRel)
      ? profileRel[0]?.full_name
      : profileRel?.full_name;
    const key = name || "—";
    supplierMap.set(key, (supplierMap.get(key) || 0) + Number(supply.amount_paid || supply.total || 0));
  }
  const bySupplier = [...supplierMap.entries()].sort((a, b) => b[1] - a[1]);

  const productMap = new Map<string, { product: Product; qty: number }>();
  for (const order of orders || []) {
    for (const item of (order.order_items || []) as Array<{
      quantity: number;
      product_id: string;
      products: Product | Product[] | null;
    }>) {
      const raw = item.products;
      const product = Array.isArray(raw) ? raw[0] : raw;
      if (!product) continue;
      const existing = productMap.get(product.id);
      if (existing) existing.qty += Number(item.quantity);
      else productMap.set(product.id, { product, qty: Number(item.quantity) });
    }
  }
  const topProducts = [...productMap.values()]
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 8);

  return (
    <RoleShell
      profile={profile}
      titleKey="report"
      nav={[
        { href: "/manager/inbox", labelKey: "inbox", icon: "🔔" },
        { href: "/manager/clients", labelKey: "clients", icon: "👥" },
        { href: "/manager/sellers", labelKey: "sellers", icon: "🏭" },
        { href: "/manager/products", labelKey: "products", icon: "🧂" },
        { href: "/manager/report", labelKey: "report", icon: "📊" },
      ]}
    >
      <Suspense fallback={null}>
        <MonthPicker value={month} />
      </Suspense>

      <div className="mb-4 grid grid-cols-1 gap-3">
        <div className="card animate-rise p-4">
          <p className="text-sm font-semibold text-ink-soft">{t.sales}</p>
          <p className="font-display text-3xl font-bold text-ok">
            {formatMoney(sales, profile.locale)}
          </p>
          <p className="mt-1 text-xs text-ink-soft">
            {t.amountPaid}: {formatMoney(collected, profile.locale)} · {t.credits}:{" "}
            {formatMoney(openCredit, profile.locale)}
          </p>
        </div>
        <div className="card animate-rise p-4" style={{ animationDelay: "40ms" }}>
          <p className="text-sm font-semibold text-ink-soft">{t.purchases}</p>
          <p className="font-display text-3xl font-bold text-bad">
            {formatMoney(purchases, profile.locale)}
          </p>
          <p className="mt-1 text-xs text-ink-soft">{t.paidToSupplier}</p>
        </div>
        <div className="card animate-rise p-4" style={{ animationDelay: "80ms" }}>
          <p className="text-sm font-semibold text-ink-soft">{t.margin}</p>
          <p className="font-display text-3xl font-bold">
            {formatMoney(margin, profile.locale)}
          </p>
        </div>
        <div className="card animate-rise p-4" style={{ animationDelay: "120ms" }}>
          <p className="text-sm font-semibold text-ink-soft">{t.clientsOnCredit}</p>
          <p className="font-display text-2xl font-bold text-accent">
            {formatMoney(Math.max(0, creditsOutstanding), profile.locale)}
          </p>
        </div>
      </div>

      <section className="mb-5 space-y-3">
        <h2 className="font-display text-xl font-bold">{t.bySupplier}</h2>
        {bySupplier.length === 0 ? (
          <div className="card p-5 text-center text-ink-soft">{t.noItems}</div>
        ) : (
          bySupplier.map(([name, total]) => (
            <div key={name} className="card flex items-center justify-between p-4">
              <span className="font-semibold">{name}</span>
              <span className="font-bold text-bad">{formatMoney(total, profile.locale)}</span>
            </div>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold">{t.topProducts}</h2>
        {topProducts.length === 0 ? (
          <div className="card p-5 text-center text-ink-soft">{t.noItems}</div>
        ) : (
          topProducts.map(({ product, qty }) => (
            <div key={product.id} className="card flex items-center justify-between p-4">
              <span className="font-semibold">{productName(product, profile.locale)}</span>
              <span className="text-ink-soft">
                {formatQty(qty, profile.locale)} {t.kg}
              </span>
            </div>
          ))
        )}
      </section>
    </RoleShell>
  );
}
