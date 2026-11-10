import { ChatThread } from "@/components/ChatThread";
import { RoleShell } from "@/components/RoleShell";
import { requireRole } from "@/lib/auth";
import { loadChatMessages } from "@/lib/chat";
import { getDictionary } from "@/lib/i18n/dictionaries";

export default async function ClientChatPage() {
  const { supabase, profile } = await requireRole(["client"]);
  const t = getDictionary(profile.locale);
  const messages = await loadChatMessages(supabase, profile.id);

  return (
    <RoleShell
      profile={profile}
      titleKey="chat"
      subtitle={t.chatWithManager}
      showBalance
      cartMode="client"
      nav={[
        { href: "/client/catalog", labelKey: "catalog", icon: "🌶️" },
        { href: "/client/cart", labelKey: "cart", icon: "🛒", cartBadge: true },
        { href: "/client/orders", labelKey: "orders", icon: "📦" },
      ]}
    >
      <ChatThread threadUserId={profile.id} viewerIsManager={false} initialMessages={messages} />
    </RoleShell>
  );
}
