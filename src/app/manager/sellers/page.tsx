import { CreateUserForm } from "@/components/CreateUserForm";
import { SetPasswordForm } from "@/components/SetPasswordForm";
import { RoleShell } from "@/components/RoleShell";
import { requireRole } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Profile } from "@/lib/types";

export default async function ManagerSellersPage() {
  const { supabase, profile } = await requireRole(["manager"]);
  const t = getDictionary(profile.locale);
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "seller")
    .order("full_name");
  const sellers = (data || []) as Profile[];

  return (
    <RoleShell
      profile={profile}
      titleKey="sellers"
      nav={[
        { href: "/manager/inbox", labelKey: "inbox", icon: "🔔" },
        { href: "/manager/clients", labelKey: "clients", icon: "👥" },
        { href: "/manager/sellers", labelKey: "sellers", icon: "🏭" },
        { href: "/manager/products", labelKey: "products", icon: "🧂" },
        { href: "/manager/report", labelKey: "report", icon: "📊" },
      ]}
    >
      <div className="space-y-4">
        <CreateUserForm role="seller" />
        <div className="space-y-3">
          {sellers.length === 0 ? (
            <div className="card p-5 text-center text-ink-soft">{t.noItems}</div>
          ) : (
            sellers.map((seller) => (
              <article key={seller.id} className="card animate-rise p-4">
                <h3 className="font-display text-lg font-bold">{seller.full_name}</h3>
                <p className="text-sm text-ink-soft">@{seller.username || "—"}</p>
                <SetPasswordForm userId={seller.id} userName={seller.full_name} />
              </article>
            ))
          )}
        </div>
      </div>
    </RoleShell>
  );
}
