import { CartView } from "@/components/CartView";
import { RoleShell } from "@/components/RoleShell";
import { requireRole } from "@/lib/auth";

export default async function ClientCartPage() {
  const { profile } = await requireRole(["client"]);

  return (
    <RoleShell
      profile={profile}
      titleKey="cart"
      showBalance
      cartMode="client"
      nav={[
        { href: "/client/catalog", labelKey: "catalog", icon: "🌶️" },
        { href: "/client/cart", labelKey: "cart", icon: "🛒", cartBadge: true },
        { href: "/client/orders", labelKey: "orders", icon: "📦" },
      ]}
    >
      <CartView mode="client" />
    </RoleShell>
  );
}
