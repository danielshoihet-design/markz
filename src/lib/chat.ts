import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChatMessage, UserRole } from "@/lib/types";

/** How many messages are loaded at a time, newest first. */
export const CHAT_PAGE_SIZE = 100;
export const CHAT_MAX_LENGTH = 2000;

export function chatHomeForRole(role: UserRole) {
  if (role === "manager") return "/manager/chat";
  if (role === "seller") return "/seller/chat";
  return "/client/chat";
}

/**
 * One page of a conversation in chronological order. Pass `before` (the
 * `created_at` of the oldest message already shown) to page backwards.
 */
export async function loadChatMessages(
  supabase: SupabaseClient,
  threadUserId: string,
  before?: string,
): Promise<ChatMessage[]> {
  let query = supabase
    .from("chat_messages")
    .select("*")
    .eq("thread_user_id", threadUserId)
    .order("created_at", { ascending: false })
    .limit(CHAT_PAGE_SIZE);
  if (before) query = query.lt("created_at", before);

  const { data, error } = await query;
  if (error) throw new Error(`Could not load messages: ${error.message}`);
  return ((data || []) as ChatMessage[]).reverse();
}

/** Adds messages to a list without duplicates, keeping chronological order. */
export function mergeChatMessages(current: ChatMessage[], incoming: ChatMessage[]) {
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort(
    (a, b) =>
      Date.parse(a.created_at) - Date.parse(b.created_at) ||
      a.created_at.localeCompare(b.created_at),
  );
}
