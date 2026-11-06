import { ProductEditor } from "@/components/ProductEditor";
import { RoleShell } from "@/components/RoleShell";
import { requireRole } from "@/lib/auth";
import type { Product } from "@/lib/types";

export default async function ManagerProductsPage() {
  const { supabase, profile } = await requireRole(["manager"]);
  const { data } = await supabase.from("products").select("*").order("sort_order");

  return (
    <RoleShell
      profile={profile}
      titleKey="products"
      nav={[
        { href: "/manager/inbox", labelKey: "inbox", icon: "🔔" },
        { href: "/manager/clients", labelKey: "clients", icon: "👥" },
        { href: "/manager/sellers", labelKey: "sellers", icon: "🏭" },
        { href: "/manager/products", labelKey: "products", icon: "🧂" },
        { href: "/manager/report", labelKey: "report", icon: "📊" },
      ]}
    >
      <ProductEditor products={(data || []) as Product[]} />
    </RoleShell>
  );
}
