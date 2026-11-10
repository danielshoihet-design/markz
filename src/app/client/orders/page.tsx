import { RoleShell } from "@/components/RoleShell";
import { StatusBadge } from "@/components/StatusBadge";
import { requireRole } from "@/lib/auth";
import { formatDate, formatMoney, formatQty } from "@/lib/format";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { productName, type Order, type Product } from "@/lib/types";

export default async function ClientOrdersPage() {
  const { supabase, profile } = await requireRole(["client"]);
  const t = getDictionary(profile.locale);
  const { data } = await supabase
    .from("orders")
    .select("*, order_items(*, products(*))")
    .eq("client_id", profile.id)
    .order("created_at", { ascending: false });

  const orders = (data || []) as Order[];

  function paymentLabel(order: Order) {
    if (!order.payment_status) return t.awaitingPayment;
    if (order.payment_status === "paid") return t.paid;
    if (order.payment_status === "partial") return t.partialPay;
    return t.unpaid;
  }

  return (
    <RoleShell
      profile={profile}
      titleKey="orders"
      showBalance
      cartMode="client"
      nav={[
        { href: "/client/catalog", labelKey: "catalog", icon: "🌶️" },
        { href: "/client/cart", labelKey: "cart", icon: "🛒", cartBadge: true },
        { href: "/client/orders", labelKey: "orders", icon: "📦" },
      ]}
    >
      <div className="space-y-3">
        {orders.length === 0 ? (
          <div className="card p-6 text-center text-ink-soft">{t.noItems}</div>
        ) : (
          orders.map((order) => {
            const due = Math.max(0, Number(order.total) - Number(order.amount_paid || 0));
            return (
              <article key={order.id} className="card animate-rise space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-ink-soft">
                      {formatDate(order.created_at, profile.locale)}
                    </p>
                    <p className="font-display text-xl font-bold">
                      {formatMoney(Number(order.total), profile.locale)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StatusBadge status={order.status} />
                    <span className="badge badge-warn">{paymentLabel(order)}</span>
                  </div>
                </div>
                <ul className="space-y-2">
                  {(order.order_items || []).map((item) => (
                    <li key={item.id} className="flex justify-between gap-3 text-sm">
                      <span>
                        {item.products
                          ? productName(item.products as Product, profile.locale)
                          : "—"}
                      </span>
                      <span className="font-semibold text-ink-soft">
                        {formatQty(Number(item.quantity), profile.locale)}{" "}
                        {(item.products as Product | null)?.unit === "unit" ? t.unit : t.kg}
                      </span>
                    </li>
                  ))}
                </ul>
                {order.payment_status ? (
                  <p className="text-sm text-ink-soft">
                    {t.amountPaid}: {formatMoney(Number(order.amount_paid || 0), profile.locale)}
                    {due > 0
                      ? ` · ${t.remaining}: ${formatMoney(due, profile.locale)}`
                      : ""}
                  </p>
                ) : null}
              </article>
            );
          })
        )}
      </div>
    </RoleShell>
  );
}
