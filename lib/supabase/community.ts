import type { CommunityComment, CommunityPost, PostCategory } from "@/lib/local/community";
import { getSupabase } from "./client";

type PostRow = {
  id: string;
  category: string;
  nickname: string;
  emoji: string;
  title: string;
  body: string;
  badge: string | null;
  symbol: string | null;
  pnl_pct: number | string | null;
  likes: number | null;
  created_at: string;
  comments?: CommentRow[];
};

type CommentRow = {
  id: string;
  nickname: string;
  emoji: string;
  body: string;
  created_at: string;
};

function mapComment(row: CommentRow): CommunityComment {
  return {
    id: row.id,
    nickname: row.nickname,
    emoji: row.emoji || "🐳",
    body: row.body,
    createdAt: new Date(row.created_at).getTime(),
  };
}

function mapPost(row: PostRow): CommunityPost {
  return {
    id: row.id,
    category: (row.category as PostCategory) ?? "STRATEGY",
    nickname: row.nickname,
    emoji: row.emoji || "🐳",
    title: row.title,
    body: row.body,
    badge: row.badge ?? undefined,
    symbol: (row.symbol as CommunityPost["symbol"]) ?? undefined,
    pnlPct: row.pnl_pct === null ? undefined : Number(row.pnl_pct),
    likes: row.likes ?? 0,
    liked: false,
    comments: (row.comments ?? [])
      .slice()
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map(mapComment),
    createdAt: new Date(row.created_at).getTime(),
  };
}

export async function fetchRemotePosts(): Promise<CommunityPost[] | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("posts")
    .select(
      "id, category, nickname, emoji, title, body, badge, symbol, pnl_pct, likes, created_at, comments(id, nickname, emoji, body, created_at)",
    )
    .order("created_at", { ascending: false })
    .limit(40);
  if (error || !data) return null;
  return (data as PostRow[]).map(mapPost);
}

export async function insertRemotePost(post: CommunityPost): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { data: session } = await supabase.auth.getSession();
  const { error } = await supabase.from("posts").insert({
    category: post.category,
    nickname: post.nickname,
    emoji: post.emoji,
    title: post.title,
    body: post.body,
    badge: post.badge ?? null,
    symbol: post.symbol ?? null,
    pnl_pct: post.pnlPct ?? null,
    user_id: session.session?.user.id ?? null,
  });
  return !error;
}

export async function insertRemoteComment(
  postId: string,
  comment: CommunityComment,
): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { data: session } = await supabase.auth.getSession();
  const { error } = await supabase.from("comments").insert({
    post_id: postId,
    nickname: comment.nickname,
    emoji: comment.emoji,
    body: comment.body,
    user_id: session.session?.user.id ?? null,
  });
  return !error;
}

export async function likeRemotePost(postId: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase.rpc("increment_post_likes", { target_post: postId });
  return !error;
}
