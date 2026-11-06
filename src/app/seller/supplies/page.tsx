import { RoleShell } from "@/components/RoleShell";
import { StatusBadge } from "@/components/StatusBadge";
import { requireRole } from "@/lib/auth";
import { formatDate, formatMoney, formatQty } from "@/lib/format";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { productName, type Product, type Supply } from "@/lib/types";

export default async function SellerSuppliesPage() {
  const { supabase, profile } = await requireRole(["seller"]);
  const t = getDictionary(profile.locale);
  const { data } = await supabase
    .from("supplies")
    .select("*, supply_items(*, products(*))")
    .eq("seller_id", profile.id)
    .order("created_at", { ascending: false });
  const supplies = (data || []) as Supply[];

  return (
    <RoleShell
      profile={profile}
      titleKey="supplies"
      cartMode="seller"
      nav={[
        { href: "/seller/catalog", labelKey: "catalog", icon: "🌶️" },
        { href: "/seller/cart", labelKey: "cart", icon: "🛒", cartBadge: true },
        { href: "/seller/supplies", labelKey: "supplies", icon: "🚚" },
      ]}
    >
      <div className="space-y-3">
        {supplies.length === 0 ? (
          <div className="card p-6 text-center text-ink-soft">{t.noItems}</div>
        ) : (
          supplies.map((supply) => (
            <article key={supply.id} className="card animate-rise space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-ink-soft">
                    {formatDate(supply.created_at, profile.locale)}
                  </p>
                  <p className="font-display text-xl font-bold">
                    {formatMoney(Number(supply.total), profile.locale)}
                  </p>
                </div>
                <StatusBadge status={supply.status} />
              </div>
              <ul className="space-y-2">
                {(supply.supply_items || []).map((item) => (
                  <li key={item.id} className="flex justify-between gap-3 text-sm">
                    <span>
                      {item.products
                        ? productName(item.products as Product, profile.locale)
                        : "—"}
                    </span>
                    <span className="font-semibold text-ink-soft">
                      {formatQty(Number(item.quantity), profile.locale)} {t.kg}
                    </span>
                  </li>
                ))}
              </ul>
            </article>
          ))
        )}
      </div>
    </RoleShell>
  );
}
