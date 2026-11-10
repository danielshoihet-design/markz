"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LinkPending } from "@/components/LinkPending";
import { useHydrated } from "@/components/useHydrated";
import { formatDate } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";
import { createClient } from "@/lib/supabase/client";
import type { ChatThreadSummary } from "@/lib/types";

let mounts = 0;

/** The manager's conversations, kept up to date as messages come in. */
export function ManagerChatList({ initialThreads }: { initialThreads: ChatThreadSummary[] }) {
  const { t, locale } = useI18n();
  const hydrated = useHydrated();
  const [threads, setThreads] = useState(initialThreads);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function load() {
      const { data, error } = await supabase.rpc("chat_threads");
      if (active && !error && data) setThreads(data as ChatThreadSummary[]);
    }

    function onVisible() {
      if (document.visibilityState === "visible") void load();
    }

    const channel = supabase
      .channel(`chat-list-${++mounts}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_messages" },
        () => void load(),
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void load();
      });
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, []);

  if (threads.length === 0) {
    return <div className="card p-5 text-center text-ink-soft">{t.noItems}</div>;
  }

  return (
    <div className="space-y-3">
      {threads.map((thread) => (
        <Link
          key={thread.user_id}
          href={`/manager/chat/${thread.user_id}`}
          className="card relative flex items-center gap-3 overflow-hidden p-4"
        >
          <LinkPending />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate font-display text-lg font-bold">
                {thread.full_name || thread.username || "—"}
              </h3>
              <span className="badge shrink-0">
                {thread.role === "seller" ? t.seller : t.client}
              </span>
            </div>
            <p className="truncate text-sm text-ink-soft">
              {thread.last_body ? (
                <>
                  {thread.last_from_manager ? `${t.chatYou}: ` : ""}
                  <bdi>{thread.last_body}</bdi>
                </>
              ) : (
                t.chatEmpty
              )}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {thread.last_at && hydrated ? (
              <span className="text-xs text-ink-soft">{formatDate(thread.last_at, locale)}</span>
            ) : null}
            {thread.unread > 0 ? (
              <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-bold text-white">
                {thread.unread}
              </span>
            ) : null}
          </div>
        </Link>
      ))}
    </div>
  );
}
