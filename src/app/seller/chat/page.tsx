import { ChatThread } from "@/components/ChatThread";
import { RoleShell } from "@/components/RoleShell";
import { requireRole } from "@/lib/auth";
import { loadChatMessages } from "@/lib/chat";
import { getDictionary } from "@/lib/i18n/dictionaries";

export default async function SellerChatPage() {
  const { supabase, profile } = await requireRole(["seller"]);
  const t = getDictionary(profile.locale);
  const messages = await loadChatMessages(supabase, profile.id);

  return (
    <RoleShell
      profile={profile}
      titleKey="chat"
      subtitle={t.chatWithManager}
      cartMode="seller"
      nav={[
        { href: "/seller/catalog", labelKey: "catalog", icon: "🌶️" },
        { href: "/seller/cart", labelKey: "cart", icon: "🛒", cartBadge: true },
        { href: "/seller/supplies", labelKey: "supplies", icon: "🚚" },
      ]}
    >
      <ChatThread threadUserId={profile.id} viewerIsManager={false} initialMessages={messages} />
    </RoleShell>
  );
}
