import { ManagerChatList } from "@/components/ManagerChatList";
import { RoleShell } from "@/components/RoleShell";
import { requireRole } from "@/lib/auth";
import type { ChatThreadSummary } from "@/lib/types";

export default async function ManagerChatPage() {
  const { supabase, profile } = await requireRole(["manager"]);
  const { data, error } = await supabase.rpc("chat_threads");
  if (error) throw new Error(`Could not load conversations: ${error.message}`);

  return (
    <RoleShell
      profile={profile}
      titleKey="chat"
      nav={[
        { href: "/manager/inbox", labelKey: "inbox", icon: "🔔" },
        { href: "/manager/clients", labelKey: "clients", icon: "👥" },
        { href: "/manager/sellers", labelKey: "sellers", icon: "🏭" },
        { href: "/manager/products", labelKey: "products", icon: "🧂" },
        { href: "/manager/report", labelKey: "report", icon: "📊" },
      ]}
    >
      <ManagerChatList initialThreads={(data || []) as ChatThreadSummary[]} />
    </RoleShell>
  );
}
