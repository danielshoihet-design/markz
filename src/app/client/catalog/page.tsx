import { ProductCard } from "@/components/ProductCard";
import { RoleShell } from "@/components/RoleShell";
import { requireRole } from "@/lib/auth";
import type { Product } from "@/lib/types";

export default async function ClientCatalogPage() {
  const { supabase, profile } = await requireRole(["client"]);
  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("active", true)
    .order("sort_order");

  const products = (data || []) as Product[];

  return (
    <RoleShell
      profile={profile}
      titleKey="catalog"
      subtitle={profile.full_name}
      showBalance
      cartMode="client"
      nav={[
        { href: "/client/catalog", labelKey: "catalog", icon: "🌶️" },
        { href: "/client/cart", labelKey: "cart", icon: "🛒", cartBadge: true },
        { href: "/client/orders", labelKey: "orders", icon: "📦" },
      ]}
    >
      <div className="grid grid-cols-2 gap-3">
        {products.map((product, index) => (
          <ProductCard
            key={product.id}
            product={product}
            locale={profile.locale}
            href={`/client/product/${product.id}`}
            price={Number(product.sell_price)}
            priceLabel="/kg"
            index={index}
          />
        ))}
      </div>
    </RoleShell>
  );
}
