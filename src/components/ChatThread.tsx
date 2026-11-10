"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useShellDock } from "@/components/ShellDock";
import { useHydrated } from "@/components/useHydrated";
import {
  CHAT_MAX_LENGTH,
  CHAT_PAGE_SIZE,
  loadChatMessages,
  mergeChatMessages,
} from "@/lib/chat";
import { formatDate } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";
import { createClient } from "@/lib/supabase/client";
import type { ChatMessage } from "@/lib/types";

/** A message that was typed but is not confirmed by the server yet. */
type Pending = { key: string; body: string; failed: boolean };

let mounts = 0;
let pendingKeys = 0;

/**
 * One conversation between a client or supplier (`threadUserId`) and the
 * manager. New messages arrive live; the composer is pinned above the bottom
 * navigation.
 */
export function ChatThread({
  threadUserId,
  viewerIsManager,
  initialMessages,
}: {
  threadUserId: string;
  viewerIsManager: boolean;
  initialMessages: ChatMessage[];
}) {
  const { t, locale } = useI18n();
  const dock = useShellDock();
  const hydrated = useHydrated();
  const [messages, setMessages] = useState(initialMessages);
  const [pending, setPending] = useState<Pending[]>([]);
  const [text, setText] = useState("");
  const [hasEarlier, setHasEarlier] = useState(initialMessages.length >= CHAT_PAGE_SIZE);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const settled = useRef(false);
  const forceScroll = useRef(false);

  // Live updates, plus a catch-up whenever the connection (re)opens or the
  // app comes back to the foreground, since phones drop the socket in the
  // background.
  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function markRead() {
      if (document.visibilityState !== "visible") return;
      await supabase.rpc("mark_chat_read", { p_thread_user_id: threadUserId });
    }

    async function catchUp() {
      try {
        const latest = await loadChatMessages(supabase, threadUserId);
        if (!active) return;
        setMessages((current) => mergeChatMessages(current, latest));
        if (latest.some((m) => m.from_manager !== viewerIsManager && !m.read_at)) {
          await markRead();
        }
      } catch {
        // Keep what is on screen; the next event or focus tries again.
      }
    }

    function onVisible() {
      if (document.visibilityState === "visible") void catchUp();
    }

    void markRead();
    const channel = supabase
      .channel(`chat-thread-${++mounts}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `thread_user_id=eq.${threadUserId}`,
        },
        (payload) => {
          const message = payload.new as ChatMessage;
          setMessages((current) => mergeChatMessages(current, [message]));
          if (message.from_manager === viewerIsManager) {
            // Our own message echoed back: it no longer needs its placeholder.
            setPending((list) => {
              const index = list.findIndex((p) => !p.failed && p.body === message.body);
              return index === -1 ? list : list.filter((_, i) => i !== index);
            });
          } else {
            void markRead();
          }
        },
      )
      .subscribe((status) => {
        if (!active) return;
        if (status === "SUBSCRIBED") {
          setReconnecting(false);
          void catchUp();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setReconnecting(true);
        }
      });
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [threadUserId, viewerIsManager]);

  // Keep the newest message in view: always when the conversation opens or we
  // send, otherwise only if the reader is already near the end.
  const lastKey = pending.at(-1)?.key ?? messages.at(-1)?.id ?? "";
  useEffect(() => {
    const page = document.documentElement;
    const distanceFromEnd = page.scrollHeight - window.scrollY - window.innerHeight;
    if (settled.current && !forceScroll.current && distanceFromEnd > 320) return;
    window.scrollTo({
      top: page.scrollHeight,
      behavior: settled.current ? "smooth" : "instant",
    });
    forceScroll.current = false;
    // The composer adds height once it is docked, so the first real position
    // is only known then.
    if (dock) settled.current = true;
  }, [lastKey, dock]);

  async function deliver(item: Pending) {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("send_chat_message", {
      p_thread_user_id: threadUserId,
      p_body: item.body,
    });
    if (error || !data) {
      setPending((list) => list.map((p) => (p.key === item.key ? { ...p, failed: true } : p)));
      return;
    }
    setPending((list) => list.filter((p) => p.key !== item.key));
    setMessages((current) => mergeChatMessages(current, [data as ChatMessage]));
  }

  function send() {
    const body = text.trim();
    if (!body) return;
    const item: Pending = { key: `pending-${++pendingKeys}`, body, failed: false };
    forceScroll.current = true;
    setText("");
    if (inputRef.current) {
      inputRef.current.style.height = "";
      inputRef.current.focus();
    }
    setPending((list) => [...list, item]);
    void deliver(item);
  }

  function retry(item: Pending) {
    setPending((list) => list.map((p) => (p.key === item.key ? { ...p, failed: false } : p)));
    void deliver(item);
  }

  async function loadEarlier() {
    const oldest = messages[0];
    if (!oldest || loadingEarlier) return;
    setLoadingEarlier(true);
    try {
      const older = await loadChatMessages(createClient(), threadUserId, oldest.created_at);
      setMessages((current) => mergeChatMessages(current, older));
      setHasEarlier(older.length >= CHAT_PAGE_SIZE);
    } catch {
      // The button stays, so the reader can try again.
    } finally {
      setLoadingEarlier(false);
    }
  }

  const composer = (
    <form
      className="border-t border-line bg-[rgba(255,253,248,0.96)] px-3 py-2"
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      {reconnecting ? (
        <p className="pb-1 text-center text-xs text-ink-soft">{t.chatOffline}</p>
      ) : null}
      <div className="flex items-end gap-2">
        <textarea
          ref={inputRef}
          value={text}
          rows={1}
          maxLength={CHAT_MAX_LENGTH}
          dir="auto"
          enterKeyHint="send"
          placeholder={t.chatPlaceholder}
          aria-label={t.chatPlaceholder}
          className="max-h-32 min-h-11 flex-1 resize-none rounded-3xl border border-line bg-white px-4 py-2.5 outline-none focus:border-accent"
          onChange={(event) => {
            setText(event.target.value);
            event.target.style.height = "auto";
            event.target.style.height = `${Math.min(event.target.scrollHeight + 2, 128)}px`;
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              send();
            }
          }}
        />
        <button type="submit" className="btn btn-primary !min-h-11 !px-5" disabled={!text.trim()}>
          {t.chatSend}
        </button>
      </div>
    </form>
  );

  return (
    <>
      <div className="flex flex-col gap-2">
        {hasEarlier ? (
          <button
            type="button"
            className="btn btn-ghost !min-h-9 self-center text-sm"
            disabled={loadingEarlier}
            onClick={loadEarlier}
          >
            {t.chatEarlier}
          </button>
        ) : null}

        {messages.length === 0 && pending.length === 0 ? (
          <p className="py-12 text-center text-ink-soft">{t.chatEmpty}</p>
        ) : null}

        {messages.map((message) => {
          const mine = message.from_manager === viewerIsManager;
          return (
            <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[82%] rounded-3xl px-4 py-2.5 ${
                  mine
                    ? "rounded-ee-lg bg-accent text-white"
                    : "rounded-es-lg border border-line bg-card"
                }`}
              >
                <p dir="auto" className="whitespace-pre-wrap [overflow-wrap:anywhere]">
                  {message.body}
                </p>
                <p className={`mt-1 min-h-4 text-[11px] ${mine ? "text-white/75" : "text-ink-soft"}`}>
                  {hydrated ? formatDate(message.created_at, locale) : ""}
                </p>
              </div>
            </div>
          );
        })}

        {pending.map((item) => (
          <div key={item.key} className="flex justify-end">
            <button
              type="button"
              disabled={!item.failed}
              onClick={() => retry(item)}
              className={`max-w-[82%] rounded-3xl rounded-ee-lg px-4 py-2.5 text-start ${
                item.failed ? "bg-[rgba(163,52,40,0.12)] text-bad" : "bg-accent text-white opacity-60"
              }`}
            >
              <span dir="auto" className="block whitespace-pre-wrap [overflow-wrap:anywhere]">
                {item.body}
              </span>
              <span className="mt-1 block text-[11px]">
                {item.failed ? t.chatNotSent : t.chatSending}
              </span>
            </button>
          </div>
        ))}
      </div>
      {dock ? createPortal(composer, dock) : null}
    </>
  );
}
