import type { ChatMessage, ChatRoom } from "@/lib/local/chat";
import { getSupabase } from "./client";

type ChatRow = {
  id: number | string;
  room: string;
  nickname: string;
  emoji: string;
  body: string;
  badge: string | null;
  created_at: string;
};

function mapRow(row: ChatRow): ChatMessage {
  return {
    id: String(row.id),
    room: (row.room as ChatRoom) ?? "all",
    nickname: row.nickname,
    emoji: row.emoji || "🐳",
    body: row.body,
    badge: row.badge ?? undefined,
    createdAt: new Date(row.created_at).getTime(),
  };
}

export async function fetchRemoteChat(room: ChatRoom): Promise<ChatMessage[] | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("chat_messages")
    .select("id, room, nickname, emoji, body, badge, created_at")
    .eq("room", room)
    .order("created_at", { ascending: false })
    .limit(60);
  if (error || !data) return null;
  return (data as ChatRow[]).reverse().map(mapRow);
}

export async function sendRemoteChat(message: ChatMessage): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { data: session } = await supabase.auth.getSession();
  const { error } = await supabase.from("chat_messages").insert({
    room: message.room,
    nickname: message.nickname,
    emoji: message.emoji,
    body: message.body,
    badge: message.badge ?? null,
    user_id: session.session?.user.id ?? null,
  });
  return !error;
}

export function subscribeRemoteChat(
  room: ChatRoom,
  onMessage: (message: ChatMessage) => void,
): () => void {
  const supabase = getSupabase();
  if (!supabase) return () => undefined;
  const channel = supabase
    .channel(`chat:${room}:${Math.random().toString(36).slice(2)}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "chat_messages", filter: `room=eq.${room}` },
      (payload) => {
        const row = payload.new as ChatRow;
        if (!row?.body) return;
        onMessage(mapRow(row));
      },
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
