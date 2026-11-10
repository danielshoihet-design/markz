"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/types";

let mounts = 0;

/**
 * Live count of chat messages waiting for this user: for the manager, unread
 * messages from any client or supplier; for everyone else, unread messages
 * from the manager. Row level security limits what each user can count.
 */
export function useChatUnread(role: UserRole) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function load() {
      const { count: unread, error } = await supabase
        .from("chat_messages")
        .select("id", { count: "exact", head: true })
        .eq("from_manager", role !== "manager")
        .is("read_at", null);
      if (active && !error && typeof unread === "number") setCount(unread);
    }

    function onVisible() {
      if (document.visibilityState === "visible") void load();
    }

    void load();
    // A unique topic per mount: reusing a topic that is still being torn down
    // by the previous page would hand back the closing channel.
    const channel = supabase
      .channel(`chat-unread-${++mounts}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_messages" },
        () => void load(),
      )
      .subscribe();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [role]);

  return count;
}
