import { CartView } from "@/components/CartView";
import { RoleShell } from "@/components/RoleShell";
import { requireRole } from "@/lib/auth";

export default async function SellerCartPage() {
  const { profile } = await requireRole(["seller"]);

  return (
    <RoleShell
      profile={profile}
      titleKey="cart"
      cartMode="seller"
      nav={[
        { href: "/seller/catalog", labelKey: "catalog", icon: "🌶️" },
        { href: "/seller/cart", labelKey: "cart", icon: "🛒", cartBadge: true },
        { href: "/seller/supplies", labelKey: "supplies", icon: "🚚" },
      ]}
    >
      <CartView mode="seller" />
    </RoleShell>
  );
}
