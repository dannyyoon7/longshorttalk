"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, Send, Settings2, Users } from "lucide-react";
import { SYMBOL_META, type Symbol } from "@/lib/constants";
import { roePercent, unrealizedPnl } from "@/lib/engine/calc";
import { useAccount } from "@/lib/engine/useAccount";
import { CHAT_BOTS, loadChat, saveChat, type ChatMessage, type ChatRoom } from "@/lib/local/chat";
import { profileStore, useProfile } from "@/lib/profile";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { fetchRemoteChat, sendRemoteChat, subscribeRemoteChat } from "@/lib/supabase/chat";
import { cn, fmtPct, fmtTimeHM, uid } from "@/lib/utils";
import { useMarketPrices } from "@/components/providers/MarketProvider";

const ROOMS: { key: ChatRoom; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "BTC", label: "BTC" },
  { key: "ETH", label: "ETH" },
];

const ONLINE: Record<ChatRoom, number> = { all: 1284, BTC: 742, ETH: 511 };

const EMOJIS = ["🐳", "🦈", "🐺", "🦊", "🐯", "🦁", "🐸", "🦅", "🐙", "🦄", "🐣", "🐜"];

function nicknameColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) % 360;
  return `hsl(${hash}, 65%, 68%)`;
}

export function ChatPanel() {
  const { prices } = useMarketPrices();
  const account = useAccount();
  const profile = useProfile();
  const [room, setRoom] = useState<ChatRoom>("all");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [editing, setEditing] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState(profile.nickname);
  const [emojiDraft, setEmojiDraft] = useState(profile.emoji);
  const listRef = useRef<HTMLDivElement | null>(null);
  const nearBottomRef = useRef(true);
  const remote = isSupabaseConfigured();

  const myBadge = useMemo(() => {
    if (account.positions.length === 0) return undefined;
    const position = [...account.positions].sort((a, b) => b.qty * b.entryPrice - a.qty * a.entryPrice)[0];
    const mark = prices[position.symbol].mark || prices[position.symbol].last;
    const pnl = unrealizedPnl(position, mark);
    const roe = roePercent(pnl, position.margin);
    const base = SYMBOL_META[position.symbol as Symbol].base;
    return `${base} ${position.leverage}x ${position.side === "LONG" ? "롱" : "숏"} ${fmtPct(roe)}`;
  }, [account.positions, prices]);

  useEffect(() => {
    profileStore.hydrate();
  }, []);

  useEffect(() => {
    setNicknameDraft(profile.nickname);
    setEmojiDraft(profile.emoji);
  }, [profile.nickname, profile.emoji]);

  // 방이 바뀌면 메시지 로드 (Supabase 있으면 원격, 없으면 로컬)
  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    const local = loadChat().filter((m) => m.room === room);
    setMessages(local);

    if (remote) {
      void fetchRemoteChat(room).then((rows) => {
        if (cancelled || !rows) return;
        setMessages((prev) => {
          const map = new Map<string, ChatMessage>();
          for (const m of [...prev, ...rows]) map.set(m.id, m);
          return Array.from(map.values()).sort((a, b) => a.createdAt - b.createdAt).slice(-120);
        });
      });
      unsubscribe = subscribeRemoteChat(room, (message) => {
        if (cancelled) return;
        setMessages((prev) =>
          prev.some((m) => m.id === message.id) ? prev : [...prev, message].slice(-150),
        );
      });
    }
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [room, remote]);

  // 데모 모드에서만 커뮤니티가 살아있는 것처럼 샘플 대화가 흐른다.
  useEffect(() => {
    if (remote) return;
    const timer = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      const bot = CHAT_BOTS[Math.floor(Math.random() * CHAT_BOTS.length)];
      const message: ChatMessage = {
        id: uid("chat"),
        room,
        nickname: bot.nickname,
        emoji: bot.emoji,
        badge: bot.badge,
        body: bot.body,
        createdAt: Date.now(),
      };
      setMessages((prev) => {
        const next = [...prev, message].slice(-150);
        const stored = loadChat();
        saveChat([...stored, message]);
        return next;
      });
    }, 22000 + Math.floor(Math.random() * 9000));
    return () => clearInterval(timer);
  }, [room, remote]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (nearBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function onScroll() {
    const el = listRef.current;
    if (!el) return;
    nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  async function send() {
    const body = input.trim();
    if (!body) return;
    const message: ChatMessage = {
      id: uid("chat"),
      room,
      nickname: profile.nickname,
      emoji: profile.emoji,
      body: body.slice(0, 300),
      badge: myBadge,
      createdAt: Date.now(),
    };
    setMessages((prev) => [...prev, message].slice(-150));
    setInput("");
    nearBottomRef.current = true;

    if (remote) {
      const ok = await sendRemoteChat(message);
      if (!ok) {
        const stored = loadChat();
        saveChat([...stored, message]);
      }
    } else {
      const stored = loadChat();
      saveChat([...stored, message]);
    }
  }

  const headerCount = remote ? ONLINE[room] : ONLINE[room];

  return (
    <section className="panel flex h-[520px] flex-col overflow-hidden xl:h-full xl:min-h-[680px]">
      <div className="border-b border-line px-2.5 py-2">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-[12px] font-semibold text-txt">
            <MessageCircle className="h-3.5 w-3.5 text-brand" /> 실시간 채팅
            <span
              className={cn(
                "rounded px-1 py-px text-[8px] font-bold tracking-wide",
                remote ? "bg-up/15 text-up" : "bg-brand/15 text-brand",
              )}
              title={remote ? "Supabase 실시간 채팅" : "Supabase 연결 전 · 브라우저 로컬 데모 채팅"}
            >
              {remote ? "LIVE" : "DEMO"}
            </span>
          </p>
          <div className="flex items-center gap-2">
            <span className="tnum flex items-center gap-1 text-[10px] text-muted">
              <Users className="h-3 w-3" /> {headerCount.toLocaleString()}
            </span>
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className="rounded border border-line p-1 text-muted transition-colors hover:text-txt"
              aria-label="닉네임 설정"
            >
              <Settings2 className="h-3 w-3" />
            </button>
          </div>
        </div>

        {editing && (
          <div className="mt-2 rounded-md border border-line bg-panel2 p-2">
            <div className="flex items-center gap-1.5">
              <input
                value={nicknameDraft}
                onChange={(e) => setNicknameDraft(e.target.value)}
                maxLength={16}
                className="min-w-0 flex-1 rounded border border-line bg-bg px-2 py-1 text-[11px] text-txt outline-none focus:border-brand/50"
                placeholder="닉네임"
              />
              <button
                type="button"
                onClick={() => {
                  profileStore.update({ nickname: nicknameDraft, emoji: emojiDraft });
                  setEditing(false);
                }}
                className="rounded bg-brand px-2 py-1 text-[10px] font-semibold text-bg"
              >
                저장
              </button>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setEmojiDraft(emoji)}
                  className={cn(
                    "h-6 w-6 rounded text-[13px] leading-none transition-colors",
                    emojiDraft === emoji ? "bg-brand/20 ring-1 ring-brand/50" : "hover:bg-panel3",
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[9px] text-muted">
              닉네임은 커뮤니티·랭킹에도 함께 표시됩니다.
            </p>
          </div>
        )}

        <div className="mt-2 flex gap-1">
          {ROOMS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setRoom(item.key)}
              className={cn(
                "rounded px-2 py-0.5 text-[10px] font-medium transition-colors",
                room === item.key ? "bg-panel3 text-txt" : "text-muted hover:text-txt",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div ref={listRef} onScroll={onScroll} className="flex-1 space-y-2.5 overflow-y-auto px-2.5 py-2.5">
        <div className="rounded-md border border-line/60 bg-panel2/40 px-2.5 py-2 text-[10px] leading-relaxed text-muted">
          롱숏톡 채팅방에 오신 것을 환영합니다. 포지션 뱃지가 자동으로 표시되고, 매매 이야기·질문 모두
          환영입니다. (모의투자 커뮤니티 · 욕설/도배는 자제해 주세요)
        </div>
        {messages.map((message) => {
          const mine = message.nickname === profile.nickname;
          return (
            <div key={message.id} className={cn("flex gap-2", mine && "rounded-md bg-brand/[0.04] p-1.5")}>
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-panel3 text-[14px]">
                {message.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-[11px] font-semibold" style={{ color: nicknameColor(message.nickname) }}>
                    {message.nickname}
                  </span>
                  {mine && <span className="rounded bg-brand/20 px-1 text-[8px] text-brand">나</span>}
                  {message.badge && (
                    <span
                      className={cn(
                        "rounded px-1 py-px text-[8px] font-semibold",
                        message.badge.includes("롱") ? "bg-up/15 text-up" : "bg-down/15 text-down",
                      )}
                    >
                      {message.badge}
                    </span>
                  )}
                  <span className="tnum ml-auto text-[8px] text-muted/70">{fmtTimeHM(message.createdAt)}</span>
                </div>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-[11.5px] leading-relaxed text-txt/90">
                  {message.body}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-line p-2">
        {myBadge && (
          <div className="mb-1.5 flex items-center gap-1 px-0.5">
            <span className="text-[9px] text-muted">내 포지션 뱃지</span>
            <span
              className={cn(
                "rounded px-1 py-px text-[8px] font-semibold",
                myBadge.includes("롱") ? "bg-up/15 text-up" : "bg-down/15 text-down",
              )}
            >
              {myBadge}
            </span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            maxLength={300}
            placeholder="메시지를 입력하세요 (Enter 전송)"
            className="min-w-0 flex-1 rounded-md border border-line bg-panel2 px-2.5 py-2 text-[11.5px] text-txt outline-none transition-colors placeholder:text-muted/60 focus:border-brand/50"
          />
          <button
            type="button"
            onClick={() => void send()}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand text-bg transition-colors hover:bg-brand/90"
            aria-label="전송"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </section>
  );
}
