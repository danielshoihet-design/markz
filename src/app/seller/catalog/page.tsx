import { ProductCard } from "@/components/ProductCard";
import { RoleShell } from "@/components/RoleShell";
import { requireRole } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { priceSlashLabel } from "@/lib/product-units";
import type { Product } from "@/lib/types";

export default async function SellerCatalogPage() {
  const { supabase, profile } = await requireRole(["seller"]);
  const t = getDictionary(profile.locale);
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
      cartMode="seller"
      nav={[
        { href: "/seller/catalog", labelKey: "catalog", icon: "🌶️" },
        { href: "/seller/cart", labelKey: "cart", icon: "🛒", cartBadge: true },
        { href: "/seller/supplies", labelKey: "supplies", icon: "🚚" },
      ]}
    >
      <div className="grid grid-cols-2 gap-3">
        {products.map((product, index) => (
          <ProductCard
            key={product.id}
            product={product}
            locale={profile.locale}
            href={`/seller/product/${product.id}`}
            price={Number(product.buy_price)}
            priceLabel={priceSlashLabel(product.unit, t)}
            index={index}
          />
        ))}
      </div>
    </RoleShell>
  );
}
