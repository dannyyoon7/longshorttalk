-- ============================================================
--  롱숏톡 (LongShortTalk) · Supabase 스키마
--  Supabase Dashboard > SQL Editor 에 그대로 붙여넣고 실행하세요.
--  (여러 번 실행해도 안전하도록 작성했습니다.)
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- 1. 프로필 ----------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null default '트레이더',
  emoji text not null default '🐳',
  created_at timestamptz not null default now()
);

-- 회원가입 시 프로필 자동 생성
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nickname, emoji)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nickname', '트레이더'),
    coalesce(new.raw_user_meta_data ->> 'emoji', '🐳')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- 2. 포지션 ----------------------------------------
create table if not exists public.positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  symbol text not null check (symbol in ('BTCUSDT', 'ETHUSDT')),
  side text not null check (side in ('LONG', 'SHORT')),
  entry_price numeric(24, 8) not null check (entry_price > 0),
  qty numeric(24, 8) not null check (qty > 0),
  leverage integer not null check (leverage between 1 and 125),
  margin_mode text not null check (margin_mode in ('CROSS', 'ISOLATED')),
  liquidation_price numeric(24, 8),
  tp numeric(24, 8),
  sl numeric(24, 8),
  status text not null default 'OPEN' check (status in ('OPEN', 'CLOSED', 'LIQUIDATED')),
  realized_pnl numeric(24, 8) not null default 0,
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);

create index if not exists positions_user_idx on public.positions (user_id, opened_at desc);
create index if not exists positions_status_idx on public.positions (status);

-- ---------- 3. 주문 ------------------------------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  symbol text not null check (symbol in ('BTCUSDT', 'ETHUSDT')),
  side text not null check (side in ('LONG', 'SHORT')),
  type text not null check (type in ('MARKET', 'LIMIT')),
  price numeric(24, 8) not null check (price > 0),
  qty numeric(24, 8) not null check (qty > 0),
  leverage integer not null check (leverage between 1 and 125),
  margin_mode text not null check (margin_mode in ('CROSS', 'ISOLATED')),
  tp numeric(24, 8),
  sl numeric(24, 8),
  status text not null default 'OPEN' check (status in ('OPEN', 'FILLED', 'CANCELED')),
  created_at timestamptz not null default now()
);

create index if not exists orders_user_idx on public.orders (user_id, created_at desc);
create index if not exists orders_status_idx on public.orders (status);

-- ---------- 4. 실시간 채팅 -----------------------------------
create table if not exists public.chat_messages (
  id bigserial primary key,
  room text not null default 'all' check (room in ('all', 'BTC', 'ETH')),
  user_id uuid references auth.users (id) on delete set null,
  nickname text not null check (char_length(nickname) between 1 and 16),
  emoji text not null default '🐳',
  body text not null check (char_length(body) between 1 and 300),
  badge text,
  created_at timestamptz not null default now()
);

create index if not exists chat_room_idx on public.chat_messages (room, created_at desc);

-- ---------- 5. 커뮤니티 글 / 댓글 ----------------------------
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  category text not null check (category in ('POSITION', 'STRATEGY', 'QUESTION')),
  nickname text not null,
  emoji text not null default '🐳',
  title text not null check (char_length(title) between 2 and 120),
  body text not null check (char_length(body) between 2 and 4000),
  badge text,
  symbol text check (symbol in ('BTCUSDT', 'ETHUSDT')),
  pnl_pct numeric(12, 2),
  likes integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists posts_created_idx on public.posts (created_at desc);
create index if not exists posts_category_idx on public.posts (category);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  nickname text not null,
  emoji text not null default '🐳',
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists comments_post_idx on public.comments (post_id, created_at asc);

-- 좋아요 증가 (비로그인도 가능한 security definer 함수)
create or replace function public.increment_post_likes(target_post uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.posts set likes = likes + 1 where id = target_post;
$$;

-- ---------- 6. 주간 랭킹 뷰 ----------------------------------
create or replace view public.weekly_leaderboard as
select
  p.id,
  p.nickname,
  p.emoji,
  count(pos.id) as closed_positions,
  coalesce(sum(pos.realized_pnl), 0) as total_pnl
from public.profiles p
left join public.positions pos
  on pos.user_id = p.id
 and pos.status <> 'OPEN'
 and pos.closed_at >= now() - interval '7 days'
group by p.id, p.nickname, p.emoji;

-- ---------- 7. RLS -------------------------------------------
alter table public.profiles enable row level security;
alter table public.positions enable row level security;
alter table public.orders enable row level security;
alter table public.chat_messages enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;

-- profiles: 모두 읽기, 본인만 수정
drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles for select using (true);

drop policy if exists "profiles upsert own" on public.profiles;
create policy "profiles upsert own" on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles for update using (auth.uid() = id);

-- positions / orders: 본인 것만
drop policy if exists "positions own" on public.positions;
create policy "positions own" on public.positions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "orders own" on public.orders;
create policy "orders own" on public.orders for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- chat: 모두 읽기, 로그인/익명 작성 허용 (user_id는 본인 또는 null)
drop policy if exists "chat read" on public.chat_messages;
create policy "chat read" on public.chat_messages for select using (true);

drop policy if exists "chat insert" on public.chat_messages;
create policy "chat insert" on public.chat_messages for insert
  with check (user_id is null or auth.uid() = user_id);

-- posts: 모두 읽기, 작성 허용
drop policy if exists "posts read" on public.posts;
create policy "posts read" on public.posts for select using (true);

drop policy if exists "posts insert" on public.posts;
create policy "posts insert" on public.posts for insert
  with check (user_id is null or auth.uid() = user_id);

drop policy if exists "posts update own" on public.posts;
create policy "posts update own" on public.posts for update
  using (user_id is not null and auth.uid() = user_id);

-- comments: 모두 읽기, 작성 허용
drop policy if exists "comments read" on public.comments;
create policy "comments read" on public.comments for select using (true);

drop policy if exists "comments insert" on public.comments;
create policy "comments insert" on public.comments for insert
  with check (user_id is null or auth.uid() = user_id);

-- ---------- 8. Realtime --------------------------------------
do $$
begin
  begin
    alter publication supabase_realtime add table public.chat_messages;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.posts;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.comments;
  exception when duplicate_object then null;
  end;
end;
$$;
