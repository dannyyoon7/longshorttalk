import { STORAGE_KEYS } from "@/lib/constants";
import { uid } from "@/lib/utils";
import { readLocal, writeLocal } from "./storage";

export type PostCategory = "POSITION" | "STRATEGY" | "QUESTION";

export type CommunityComment = {
  id: string;
  nickname: string;
  emoji: string;
  body: string;
  createdAt: number;
};

export type CommunityPost = {
  id: string;
  category: PostCategory;
  nickname: string;
  emoji: string;
  title: string;
  body: string;
  badge?: string;
  symbol?: "BTCUSDT" | "ETHUSDT";
  pnlPct?: number;
  likes: number;
  liked: boolean;
  comments: CommunityComment[];
  createdAt: number;
  mine?: boolean;
};

export const CATEGORY_LABEL: Record<PostCategory, string> = {
  POSITION: "포지션 인증",
  STRATEGY: "매매 전략",
  QUESTION: "질문",
};

const MIN = 60_000;
const HOUR = 60 * MIN;

function seed(): CommunityPost[] {
  const now = Date.now();
  return [
    {
      id: "seed_1",
      category: "POSITION",
      nickname: "롱충이",
      emoji: "🐳",
      title: "BTC 20x 롱 +18.4% 익절 완료",
      body: "아침에 4시간봉 지지 확인하고 20x 롱 진입했어요. TP 걸어둔 1.2% 위에서 자동 익절됐습니다. 레버리지 20배는 제 기준 최대치라 여기서는 무조건 익절합니다. 다음 눌림 오면 또 롱 볼게요.",
      badge: "BTC 20x 롱 +18.4%",
      symbol: "BTCUSDT",
      pnlPct: 18.4,
      likes: 42,
      liked: false,
      createdAt: now - 2 * HOUR,
      comments: [
        {
          id: "seed_c1",
          nickname: "스캘퍼김",
          emoji: "🦅",
          body: "깔끔하네요. 저는 그 구간에서 손절당했는데 부럽습니다 ㅋㅋ",
          createdAt: now - 100 * MIN,
        },
        {
          id: "seed_c2",
          nickname: "리스크관리자",
          emoji: "🐸",
          body: "익절 원칙 지킨 게 제일 좋은 포인트네요.",
          createdAt: now - 80 * MIN,
        },
      ],
    },
    {
      id: "seed_2",
      category: "STRATEGY",
      nickname: "차트도사",
      emoji: "🦉",
      title: "선물 초보가 가장 먼저 익혀야 하는 3가지",
      body: "1) 레버리지는 3~5x로 시작. 2) 진입 전에 청산가를 먼저 계산하고 손절 폭을 정하기. 3) 교차 모드는 지갑 전체가 담보라는 걸 기억하기. 이 세 개만 지켜도 계좌가 사라지는 속도가 확 달라집니다.",
      likes: 88,
      liked: false,
      createdAt: now - 6 * HOUR,
      comments: [
        {
          id: "seed_c3",
          nickname: "초보탈출",
          emoji: "🐣",
          body: "교차 모드가 그런 거였군요… 격리로 바꿔야겠어요.",
          createdAt: now - 5 * HOUR,
        },
      ],
    },
    {
      id: "seed_3",
      category: "POSITION",
      nickname: "이더리움신봉자",
      emoji: "🦄",
      title: "ETH 50x 숏 +9.7% 짧게 먹었습니다",
      body: "ETH가 15분봉 저항에서 계속 막히길래 50x 숏으로 5분만 들고 있었어요. 50배는 정말 짧게만, 손절은 -0.4%로 타이트하게 걸었습니다. 따라하실 분들은 레버리지 절대 그대로 하지 마세요.",
      badge: "ETH 50x 숏 +9.7%",
      symbol: "ETHUSDT",
      pnlPct: 9.7,
      likes: 27,
      liked: false,
      createdAt: now - 9 * HOUR,
      comments: [],
    },
    {
      id: "seed_4",
      category: "QUESTION",
      nickname: "초보탈출",
      emoji: "🐣",
      title: "펀딩비는 언제 내고 언제 받나요?",
      body: "롱만 들고 있는데 8시간마다 뭔가 빠져나가는 것 같아서요. 펀딩비가 플러스면 롱이 내는 건가요?",
      likes: 12,
      liked: false,
      createdAt: now - 26 * HOUR,
      comments: [
        {
          id: "seed_c4",
          nickname: "펀딩비수집가",
          emoji: "🐙",
          body: "펀딩비가 +면 롱이 숏에게 지급, -면 반대입니다. 00/08/16시(UTC 기준)에 정산돼요.",
          createdAt: now - 25 * HOUR,
        },
        {
          id: "seed_c5",
          nickname: "차트도사",
          emoji: "🦉",
          body: "가이드 페이지에 계산 방식 자세히 나와 있어요. 거기 보고 오시면 이해 빠릅니다.",
          createdAt: now - 24 * HOUR,
        },
      ],
    },
    {
      id: "seed_5",
      category: "STRATEGY",
      nickname: "리스크관리자",
      emoji: "🐸",
      title: "청산가 계산 공식 정리 (격리 기준)",
      body: "롱: 진입가 × (1 - 1/레버리지 + 유지증거금률) / 숏: 진입가 × (1 + 1/레버리지 - 유지증거금률). 유지증거금률은 BTC/ETH 1단계 기준 0.4%입니다. 20x 롱이면 대략 -4.6%에서 청산이라는 뜻이에요.",
      likes: 64,
      liked: false,
      createdAt: now - 30 * HOUR,
      comments: [],
    },
    {
      id: "seed_6",
      category: "POSITION",
      nickname: "존버장인",
      emoji: "🦁",
      title: "BTC 10x 롱 3일째 홀딩 중 (+7.2%)",
      body: "레버리지 낮추고 10x로만 갑니다. 밤에 자도 청산 걱정이 없어서 좋네요. 펀딩비 나가는 건 감수합니다.",
      badge: "BTC 10x 롱 +7.2%",
      symbol: "BTCUSDT",
      pnlPct: 7.2,
      likes: 19,
      liked: false,
      createdAt: now - 40 * HOUR,
      comments: [],
    },
  ];
}

export function loadPosts(): CommunityPost[] {
  const stored = readLocal<CommunityPost[]>(STORAGE_KEYS.community, []);
  if (stored.length > 0) return stored;
  const seeded = seed();
  writeLocal(STORAGE_KEYS.community, seeded);
  return seeded;
}

export function savePosts(posts: CommunityPost[]): void {
  writeLocal(STORAGE_KEYS.community, posts);
}

export function createPost(input: {
  category: PostCategory;
  nickname: string;
  emoji: string;
  title: string;
  body: string;
  badge?: string;
  symbol?: "BTCUSDT" | "ETHUSDT";
  pnlPct?: number;
}): CommunityPost {
  return {
    id: uid("post"),
    category: input.category,
    nickname: input.nickname,
    emoji: input.emoji,
    title: input.title,
    body: input.body,
    badge: input.badge,
    symbol: input.symbol,
    pnlPct: input.pnlPct,
    likes: 0,
    liked: false,
    comments: [],
    createdAt: Date.now(),
    mine: true,
  };
}

export function createComment(nickname: string, emoji: string, body: string): CommunityComment {
  return { id: uid("cmt"), nickname, emoji, body, createdAt: Date.now() };
}
