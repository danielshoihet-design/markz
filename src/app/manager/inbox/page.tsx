import { DailySummary } from "@/components/DailySummary";
import { ManagerInbox } from "@/components/ManagerInbox";
import { RoleShell } from "@/components/RoleShell";
import { requireRole } from "@/lib/auth";
import type { Order, Profile, Supply } from "@/lib/types";

export default async function ManagerInboxPage() {
  const { supabase, profile } = await requireRole(["manager"]);

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)).toISOString();
  const nextMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 1)).toISOString();

  const [
    { data: orders },
    { data: supplies },
    { count },
    { data: monthOrders },
    { data: monthSupplies },
    { data: creditClients },
  ] = await Promise.all([
    supabase
      .from("orders")
      .select("*, profiles!client_id(*), order_items(*, products(*))")
      .or("payment_status.is.null,status.eq.pending")
      .neq("status", "rejected")
      .order("created_at", { ascending: false }),
    supabase
      .from("supplies")
      .select("*, profiles!seller_id(*), supply_items(*, products(*))")
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .eq("read", false),
    supabase
      .from("orders")
      .select("total, amount_paid, payment_status")
      .gte("created_at", monthStart)
      .lt("created_at", nextMonth)
      .neq("status", "rejected"),
    supabase
      .from("supplies")
      .select("total, amount_paid, status")
      .eq("status", "accepted")
      .gte("created_at", monthStart)
      .lt("created_at", nextMonth),
    supabase
      .from("profiles")
      .select("id, full_name, credit_balance")
      .eq("role", "client")
      .gt("credit_balance", 0)
      .order("credit_balance", { ascending: false }),
  ]);

  await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", profile.id)
    .eq("read", false);

  const monthSales = (monthOrders || []).reduce((sum, o) => sum + Number(o.total || 0), 0);
  const monthCredit = (monthOrders || []).reduce((sum, o) => {
    if (!o.payment_status) return sum;
    return sum + Math.max(0, Number(o.total || 0) - Number(o.amount_paid || 0));
  }, 0);
  const monthSupplierSpend = (monthSupplies || []).reduce(
    (sum, s) => sum + Number(s.amount_paid || s.total || 0),
    0,
  );

  // Show awaiting-payment orders first in inbox; also include recent unpaid needing attention
  const inboxOrders = ((orders || []) as Order[]).filter(
    (o) => !o.payment_status || o.status === "pending",
  );

  return (
    <RoleShell
      profile={profile}
      titleKey="inbox"
      nav={[
        { href: "/manager/inbox", labelKey: "inbox", icon: "🔔", badge: count || 0 },
        { href: "/manager/clients", labelKey: "clients", icon: "👥" },
        { href: "/manager/sellers", labelKey: "sellers", icon: "🏭" },
        { href: "/manager/products", labelKey: "products", icon: "🧂" },
        { href: "/manager/report", labelKey: "report", icon: "📊" },
      ]}
    >
      <DailySummary
        monthSales={monthSales}
        monthCredit={monthCredit}
        monthSupplierSpend={monthSupplierSpend}
        creditClients={(creditClients || []) as Pick<Profile, "id" | "full_name" | "credit_balance">[]}
      />
      <ManagerInbox
        initialOrders={inboxOrders}
        initialSupplies={(supplies || []) as Supply[]}
      />
    </RoleShell>
  );
}
