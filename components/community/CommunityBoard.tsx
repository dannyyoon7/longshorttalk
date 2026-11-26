"use client";

import { useEffect, useMemo, useState } from "react";
import { Heart, MessageSquare, PenLine, Send, TrendingUp, X } from "lucide-react";
import { STORAGE_KEYS, SYMBOL_META } from "@/lib/constants";
import { roePercent, unrealizedPnl } from "@/lib/engine/calc";
import { useAccount } from "@/lib/engine/useAccount";
import {
  CATEGORY_LABEL,
  createComment,
  createPost,
  loadPosts,
  savePosts,
  type CommunityPost,
  type PostCategory,
} from "@/lib/local/community";
import { profileStore, useProfile } from "@/lib/profile";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { fetchRemotePosts, insertRemoteComment, insertRemotePost, likeRemotePost } from "@/lib/supabase/community";
import { useMarketPrices } from "@/components/providers/MarketProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { cn, fmtPct, timeAgo } from "@/lib/utils";

type Filter = "ALL" | PostCategory;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "ALL", label: "전체" },
  { key: "POSITION", label: "포지션 인증" },
  { key: "STRATEGY", label: "매매 전략" },
  { key: "QUESTION", label: "질문" },
];

const CATEGORY_STYLE: Record<PostCategory, string> = {
  POSITION: "border-up/30 bg-up/10 text-up",
  STRATEGY: "border-brand/30 bg-brand/10 text-brand",
  QUESTION: "border-[#B48CF2]/30 bg-[#B48CF2]/10 text-[#B48CF2]",
};

export function CommunityBoard() {
  const { prices } = useMarketPrices();
  const account = useAccount();
  const profile = useProfile();
  const { push } = useToast();
  const remote = isSupabaseConfigured();

  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [query, setQuery] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    category: "POSITION" as PostCategory,
    title: "",
    body: "",
    badge: "",
  });

  useEffect(() => {
    profileStore.hydrate();
    const local = loadPosts();
    setPosts(local);

    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.shareDraft);
      if (raw) {
        const draft = JSON.parse(raw) as { title?: string; body?: string; badge?: string };
        setForm((prev) => ({
          ...prev,
          title: draft.title ?? "",
          body: draft.body ?? "",
          badge: draft.badge ?? "",
        }));
        setComposerOpen(true);
        window.localStorage.removeItem(STORAGE_KEYS.shareDraft);
      } else if (window.location.hash === "#write") {
        setComposerOpen(true);
      }
    } catch {
      /* noop */
    }

    if (remote) {
      void fetchRemotePosts().then((rows) => {
        if (!rows) return;
        setPosts((prev) => {
          const localOnly = prev.filter((p) => p.mine);
          const map = new Map<string, CommunityPost>();
          for (const post of [...rows, ...localOnly]) map.set(post.id, post);
          return Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt);
        });
      });
    }
  }, [remote]);

  const myBadge = useMemo(() => {
    if (account.positions.length === 0) return "";
    const position = account.positions[0];
    const mark = prices[position.symbol].mark || prices[position.symbol].last;
    const roe = roePercent(unrealizedPnl(position, mark), position.margin);
    const base = SYMBOL_META[position.symbol].base;
    return `${base} ${position.leverage}x ${position.side === "LONG" ? "롱" : "숏"} ${fmtPct(roe)}`;
  }, [account.positions, prices]);

  const filtered = useMemo(() => {
    return posts
      .filter((post) => (filter === "ALL" ? true : post.category === filter))
      .filter((post) => {
        if (!query.trim()) return true;
        const q = query.trim().toLowerCase();
        return (
          post.title.toLowerCase().includes(q) ||
          post.body.toLowerCase().includes(q) ||
          post.nickname.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [posts, filter, query]);

  function persist(next: CommunityPost[]) {
    setPosts(next);
    savePosts(next);
  }

  function submitPost() {
    if (form.title.trim().length < 2) {
      push("제목을 2자 이상 입력해 주세요.", "error");
      return;
    }
    if (form.body.trim().length < 2) {
      push("내용을 2자 이상 입력해 주세요.", "error");
      return;
    }
    const post = createPost({
      category: form.category,
      nickname: profile.nickname,
      emoji: profile.emoji,
      title: form.title.trim().slice(0, 120),
      body: form.body.trim().slice(0, 4000),
      badge: form.badge.trim() || undefined,
    });
    persist([post, ...posts]);
    setForm({ category: "POSITION", title: "", body: "", badge: "" });
    setComposerOpen(false);
    setFilter("ALL");
    push("글이 등록되었습니다.", "success");
    if (remote) void insertRemotePost(post);
  }

  function toggleLike(postId: string) {
    persist(
      posts.map((post) =>
        post.id === postId
          ? { ...post, liked: !post.liked, likes: post.likes + (post.liked ? -1 : 1) }
          : post,
      ),
    );
    const target = posts.find((p) => p.id === postId);
    if (remote && target && !target.liked) void likeRemotePost(postId);
  }

  function submitComment(postId: string) {
    const text = (commentDrafts[postId] ?? "").trim();
    if (!text) return;
    const comment = createComment(profile.nickname, profile.emoji, text.slice(0, 1000));
    persist(
      posts.map((post) =>
        post.id === postId ? { ...post, comments: [...post.comments, comment] } : post,
      ),
    );
    setCommentDrafts((prev) => ({ ...prev, [postId]: "" }));
    if (remote) void insertRemoteComment(postId, comment);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 overflow-x-auto rounded-lg border border-line bg-panel p-1">
          {FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              className={cn(
                "shrink-0 rounded px-2.5 py-1 text-[11px] font-medium transition-colors",
                filter === item.key ? "bg-panel3 text-txt" : "text-muted hover:text-txt",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="제목·내용·닉네임 검색"
          className="min-w-0 flex-1 rounded-md border border-line bg-panel px-2.5 py-1.5 text-[11px] text-txt outline-none focus:border-brand/50"
        />
        <button
          type="button"
          onClick={() => setComposerOpen((v) => !v)}
          className="flex items-center gap-1 rounded-md bg-brand px-3 py-1.5 text-[11px] font-semibold text-bg hover:bg-brand/90"
        >
          {composerOpen ? <X className="h-3.5 w-3.5" /> : <PenLine className="h-3.5 w-3.5" />}
          {composerOpen ? "닫기" : "글쓰기"}
        </button>
      </div>

      {composerOpen && (
        <section className="rounded-lg border border-line bg-panel p-3">
          <div className="flex flex-wrap gap-1">
            {(Object.keys(CATEGORY_LABEL) as PostCategory[]).map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, category }))}
                className={cn(
                  "rounded border px-2 py-1 text-[10px]",
                  form.category === category
                    ? CATEGORY_STYLE[category]
                    : "border-line text-muted hover:text-txt",
                )}
              >
                {CATEGORY_LABEL[category]}
              </button>
            ))}
          </div>
          <input
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            maxLength={120}
            placeholder="제목 (예: BTC 20x 롱 +18.4% 익절 완료)"
            className="mt-2 w-full rounded border border-line bg-panel2 px-2.5 py-2 text-[12px] text-txt outline-none focus:border-brand/50"
          />
          <textarea
            value={form.body}
            onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))}
            maxLength={4000}
            rows={5}
            placeholder="포지션·전략·질문 내용을 적어주세요. (모의투자 기록 공유)"
            className="mt-2 w-full resize-y rounded border border-line bg-panel2 px-2.5 py-2 text-[12px] leading-relaxed text-txt outline-none focus:border-brand/50"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              <span className="shrink-0 text-[10px] text-muted">포지션 뱃지</span>
              <input
                value={form.badge}
                onChange={(e) => setForm((prev) => ({ ...prev, badge: e.target.value }))}
                maxLength={40}
                placeholder="예: BTC 20x 롱 +18.4%"
                className="min-w-0 flex-1 rounded border border-line bg-panel2 px-2 py-1 text-[10px] text-txt outline-none focus:border-brand/50"
              />
              {myBadge && (
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, badge: myBadge }))}
                  className="shrink-0 rounded border border-brand/40 px-1.5 py-1 text-[9px] text-brand"
                >
                  내 포지션
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={submitPost}
              className="flex items-center gap-1 rounded-md bg-brand px-3 py-1.5 text-[11px] font-semibold text-bg"
            >
              <Send className="h-3 w-3" /> 등록
            </button>
          </div>
          <p className="mt-1.5 text-[9px] text-muted/70">
            {remote ? "Supabase에 저장되어 모든 사용자에게 공개됩니다." : "지금은 데모 모드로 이 브라우저에만 저장됩니다."}
          </p>
        </section>
      )}

      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="rounded-lg border border-line bg-panel px-4 py-10 text-center text-[12px] text-muted">
            아직 글이 없습니다. 첫 글을 남겨보세요.
          </div>
        )}
        {filtered.map((post) => {
          const isExpanded = expanded === post.id;
          const long = post.body.length > 160;
          return (
            <article key={post.id} className="rounded-lg border border-line bg-panel p-3 sm:p-4">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-panel3 text-[15px]">
                  {post.emoji}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11.5px] font-semibold text-txt">{post.nickname}</span>
                    <span className={cn("rounded border px-1 py-px text-[8px]", CATEGORY_STYLE[post.category])}>
                      {CATEGORY_LABEL[post.category]}
                    </span>
                    {post.badge && (
                      <span
                        className={cn(
                          "rounded px-1 py-px text-[8px] font-semibold",
                          post.badge.includes("롱") ? "bg-up/15 text-up" : "bg-down/15 text-down",
                        )}
                      >
                        {post.badge}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[9px] text-muted">{timeAgo(post.createdAt)}</p>
                </div>
                {typeof post.pnlPct === "number" && (
                  <span
                    className={cn(
                      "ml-auto flex items-center gap-0.5 text-[11px] font-semibold",
                      post.pnlPct >= 0 ? "text-up" : "text-down",
                    )}
                  >
                    <TrendingUp className="h-3 w-3" />
                    {fmtPct(post.pnlPct)}
                  </span>
                )}
              </div>

              <h3 className="mt-2.5 text-[13px] font-semibold leading-snug text-txt">{post.title}</h3>
              <p
                className={cn(
                  "mt-1.5 whitespace-pre-wrap text-[11.5px] leading-relaxed text-muted",
                  !isExpanded && long && "line-clamp-3",
                )}
              >
                {post.body}
              </p>
              {long && (
                <button
                  type="button"
                  onClick={() => setExpanded(isExpanded ? null : post.id)}
                  className="mt-1 text-[10px] text-brand hover:underline"
                >
                  {isExpanded ? "접기" : "더보기"}
                </button>
              )}

              <div className="mt-2.5 flex items-center gap-3 border-t border-line/60 pt-2">
                <button
                  type="button"
                  onClick={() => toggleLike(post.id)}
                  className={cn(
                    "flex items-center gap-1 text-[10px] transition-colors",
                    post.liked ? "text-down" : "text-muted hover:text-txt",
                  )}
                >
                  <Heart className={cn("h-3.5 w-3.5", post.liked && "fill-current")} /> {post.likes}
                </button>
                <button
                  type="button"
                  onClick={() => setExpanded(isExpanded ? null : post.id)}
                  className="flex items-center gap-1 text-[10px] text-muted hover:text-txt"
                >
                  <MessageSquare className="h-3.5 w-3.5" /> 댓글 {post.comments.length}
                </button>
                <span className="ml-auto text-[9px] text-muted/60">
                  {post.symbol ? `${SYMBOL_META[post.symbol].base} 모의매매` : "롱숏톡"}
                </span>
              </div>

              {isExpanded && (
                <div className="mt-2.5 space-y-2 rounded-md border border-line/60 bg-panel2/40 p-2.5">
                  {post.comments.length === 0 && (
                    <p className="text-[10px] text-muted">첫 댓글을 남겨보세요.</p>
                  )}
                  {post.comments.map((comment) => (
                    <div key={comment.id} className="flex gap-1.5">
                      <span className="text-[12px]">{comment.emoji}</span>
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 text-[10px] text-muted">
                          <span className="font-semibold text-txt/80">{comment.nickname}</span>
                          <span className="text-[8px]">{timeAgo(comment.createdAt)}</span>
                        </p>
                        <p className="mt-0.5 whitespace-pre-wrap text-[11px] text-txt/85">{comment.body}</p>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center gap-1.5 pt-1">
                    <input
                      value={commentDrafts[post.id] ?? ""}
                      onChange={(e) =>
                        setCommentDrafts((prev) => ({ ...prev, [post.id]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") submitComment(post.id);
                      }}
                      maxLength={1000}
                      placeholder={`${profile.nickname}(으)로 댓글 남기기`}
                      className="min-w-0 flex-1 rounded border border-line bg-bg px-2 py-1.5 text-[10.5px] text-txt outline-none focus:border-brand/50"
                    />
                    <button
                      type="button"
                      onClick={() => submitComment(post.id)}
                      className="rounded bg-panel3 px-2 py-1.5 text-[10px] text-txt hover:bg-brand hover:text-bg"
                    >
                      등록
                    </button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
