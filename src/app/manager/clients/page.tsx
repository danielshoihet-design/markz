import { CreateUserForm } from "@/components/CreateUserForm";
import { GrantCreditsForm } from "@/components/GrantCreditsForm";
import { RoleShell } from "@/components/RoleShell";
import { requireRole } from "@/lib/auth";
import { formatMoney } from "@/lib/format";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Profile } from "@/lib/types";

export default async function ManagerClientsPage() {
  const { supabase, profile } = await requireRole(["manager"]);
  const t = getDictionary(profile.locale);
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "client")
    .order("full_name");
  const clients = (data || []) as Profile[];

  return (
    <RoleShell
      profile={profile}
      titleKey="clients"
      nav={[
        { href: "/manager/inbox", labelKey: "inbox", icon: "🔔" },
        { href: "/manager/clients", labelKey: "clients", icon: "👥" },
        { href: "/manager/sellers", labelKey: "sellers", icon: "🏭" },
        { href: "/manager/products", labelKey: "products", icon: "🧂" },
        { href: "/manager/report", labelKey: "report", icon: "📊" },
      ]}
    >
      <div className="space-y-4">
        <CreateUserForm role="client" />
        <div className="space-y-3">
          {clients.length === 0 ? (
            <div className="card p-5 text-center text-ink-soft">{t.noItems}</div>
          ) : (
            clients.map((client) => (
              <article key={client.id} className="card animate-rise p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-lg font-bold">{client.full_name}</h3>
                    <p className="text-sm text-ink-soft">{client.email}</p>
                    <p className="mt-1 font-semibold text-ok">
                      {t.balance}: {formatMoney(Number(client.credit_balance), profile.locale)}
                    </p>
                  </div>
                </div>
                <GrantCreditsForm
                  clientId={client.id}
                  clientName={client.full_name}
                  currentDebt={Number(client.credit_balance)}
                />
              </article>
            ))
          )}
        </div>
      </div>
    </RoleShell>
  );
}
