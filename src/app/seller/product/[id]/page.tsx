import Link from "next/link";
import { notFound } from "next/navigation";
import { RoleShell } from "@/components/RoleShell";
import { SupplyForm } from "@/components/SupplyForm";
import { requireRole } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Product } from "@/lib/types";

export default async function SellerProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, profile } = await requireRole(["seller"]);
  const t = getDictionary(profile.locale);
  const { data } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();

  return (
    <RoleShell
      profile={profile}
      titleKey="catalog"
      cartMode="seller"
      nav={[
        { href: "/seller/catalog", labelKey: "catalog", icon: "🌶️" },
        { href: "/seller/cart", labelKey: "cart", icon: "🛒", cartBadge: true },
        { href: "/seller/supplies", labelKey: "supplies", icon: "🚚" },
      ]}
    >
      <Link href="/seller/catalog" className="mb-3 inline-flex text-sm font-bold text-ink-soft">
        ← {t.back}
      </Link>
      <SupplyForm product={data as Product} />
    </RoleShell>
  );
}
