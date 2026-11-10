import Link from "next/link";
import { notFound } from "next/navigation";
import { ChatThread } from "@/components/ChatThread";
import { RoleShell } from "@/components/RoleShell";
import { requireRole } from "@/lib/auth";
import { loadChatMessages } from "@/lib/chat";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isValidUuid } from "@/lib/security";

export default async function ManagerChatThreadPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  if (!isValidUuid(userId)) notFound();

  const { supabase, profile } = await requireRole(["manager"]);
  const t = getDictionary(profile.locale);
  const [{ data: other }, messages] = await Promise.all([
    supabase.from("profiles").select("id, full_name, username, role").eq("id", userId).maybeSingle(),
    loadChatMessages(supabase, userId),
  ]);
  // Conversations exist only with clients and suppliers.
  if (!other || other.role === "manager") notFound();

  const roleLabel = other.role === "seller" ? t.seller : t.client;

  return (
    <RoleShell
      profile={profile}
      titleKey="chat"
      subtitle={`${other.full_name || other.username || "—"} · ${roleLabel}`}
      nav={[
        { href: "/manager/inbox", labelKey: "inbox", icon: "🔔" },
        { href: "/manager/clients", labelKey: "clients", icon: "👥" },
        { href: "/manager/sellers", labelKey: "sellers", icon: "🏭" },
        { href: "/manager/products", labelKey: "products", icon: "🧂" },
        { href: "/manager/report", labelKey: "report", icon: "📊" },
      ]}
    >
      <Link href="/manager/chat" className="mb-3 inline-flex text-sm font-bold text-ink-soft">
        ← {t.back}
      </Link>
      <ChatThread key={other.id} threadUserId={other.id} viewerIsManager initialMessages={messages} />
    </RoleShell>
  );
}
