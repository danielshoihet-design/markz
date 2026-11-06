import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderForm } from "@/components/OrderForm";
import { RoleShell } from "@/components/RoleShell";
import { requireRole } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Product } from "@/lib/types";

export default async function ClientProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, profile } = await requireRole(["client"]);
  const t = getDictionary(profile.locale);
  const { data } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const product = data as Product;

  return (
    <RoleShell
      profile={profile}
      titleKey="catalog"
      showBalance
      cartMode="client"
      nav={[
        { href: "/client/catalog", labelKey: "catalog", icon: "🌶️" },
        { href: "/client/cart", labelKey: "cart", icon: "🛒", cartBadge: true },
        { href: "/client/orders", labelKey: "orders", icon: "📦" },
      ]}
    >
      <Link href="/client/catalog" className="mb-3 inline-flex text-sm font-bold text-ink-soft">
        ← {t.back}
      </Link>
      <OrderForm product={product} />
    </RoleShell>
  );
}
