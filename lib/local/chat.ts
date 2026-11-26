import { STORAGE_KEYS } from "@/lib/constants";
import { uid } from "@/lib/utils";
import { readLocal, writeLocal } from "./storage";

export type ChatRoom = "all" | "BTC" | "ETH";

export type ChatMessage = {
  id: string;
  room: ChatRoom;
  nickname: string;
  emoji: string;
  body: string;
  badge?: string;
  createdAt: number;
};

const MIN = 60_000;

function seed(): ChatMessage[] {
  const now = Date.now();
  return [
    {
      id: uid("chat"),
      room: "all",
      nickname: "청산각",
      emoji: "🦈",
      body: "아침에 숏 잡았다가 0.3%에 손절… 오늘은 롱만 칩니다 ㅠㅠ",
      badge: "ETH 25x 숏 -12.4%",
      createdAt: now - 42 * MIN,
    },
    {
      id: uid("chat"),
      room: "all",
      nickname: "롱충이",
      emoji: "🐳",
      body: "BTC 20x 롱 홀딩 3시간째. 이번엔 진짜 갑니다",
      badge: "BTC 20x 롱 +18.4%",
      createdAt: now - 35 * MIN,
    },
    {
      id: uid("chat"),
      room: "all",
      nickname: "스캘퍼김",
      emoji: "🦅",
      body: "1분봉 상단 꼬리 계속 나오는데 여기서 롱은 좀 위험해 보여요",
      createdAt: now - 28 * MIN,
    },
    {
      id: uid("chat"),
      room: "all",
      nickname: "펀딩비수집가",
      emoji: "🐙",
      body: "펀딩비 +0.01%면 롱이 계속 내는 구조. 숏이 유리한 구간인 듯",
      createdAt: now - 17 * MIN,
    },
    {
      id: uid("chat"),
      room: "all",
      nickname: "초보탈출",
      emoji: "🐣",
      body: "교차랑 격리 차이가 뭐예요? 격리하면 청산가가 더 가까운 건가요?",
      createdAt: now - 9 * MIN,
    },
    {
      id: uid("chat"),
      room: "all",
      nickname: "차트도사",
      emoji: "🦉",
      body: "격리는 그 포지션 증거금만 날리는 거라 청산가가 가깝고, 교차는 지갑 전체가 담보라 멀어요. 대신 교차는 한 번에 다 날릴 수 있음",
      createdAt: now - 7 * MIN,
    },
    {
      id: uid("chat"),
      room: "BTC",
      nickname: "비트맥스",
      emoji: "🐺",
      body: "BTC 4시간봉 이평선 위로 다시 올라왔네요. 20x 롱 짧게",
      badge: "BTC 20x 롱 +6.2%",
      createdAt: now - 22 * MIN,
    },
    {
      id: uid("chat"),
      room: "BTC",
      nickname: "존버장인",
      emoji: "🦁",
      body: "레버리지 10x로 낮춰서 갑니다. 100x는 진짜 심장이 안 버텨요",
      createdAt: now - 12 * MIN,
    },
    {
      id: uid("chat"),
      room: "ETH",
      nickname: "이더리움신봉자",
      emoji: "🦄",
      body: "ETH 오늘 변동성 BTC보다 큰데요? 숏 스캘핑 각",
      badge: "ETH 50x 숏 +9.7%",
      createdAt: now - 19 * MIN,
    },
    {
      id: uid("chat"),
      room: "ETH",
      nickname: "개미1234",
      emoji: "🐜",
      body: "TP/SL 같이 걸어두니까 마음이 편하네요. 강제청산 무서워서 3x만 씁니다",
      createdAt: now - 5 * MIN,
    },
  ];
}

export function loadChat(): ChatMessage[] {
  const stored = readLocal<ChatMessage[]>(STORAGE_KEYS.chat, []);
  if (stored.length > 0) return stored;
  const seeded = seed();
  writeLocal(STORAGE_KEYS.chat, seeded);
  return seeded;
}

export function saveChat(messages: ChatMessage[]): void {
  writeLocal(STORAGE_KEYS.chat, messages.slice(-250));
}

export const CHAT_BOTS: { nickname: string; emoji: string; badge?: string; body: string }[] = [
  { nickname: "숏충이", emoji: "🦈", badge: "BTC 50x 숏 +31.2%", body: "이 구간 숏이 답임. 거래량 안 붙는데 위로 못 감" },
  { nickname: "롱충이", emoji: "🐳", body: "아직 롱 홀딩. 청산가 아직 멀어서 버팁니다" },
  { nickname: "스캘퍼김", emoji: "🦅", badge: "ETH 25x 롱 +4.1%", body: "1분봉 눌림마다 롱 스캘핑 중" },
  { nickname: "차트도사", emoji: "🦉", body: "여기서 4시간봉 마감 보면 방향 나올 듯" },
  { nickname: "초보탈출", emoji: "🐣", body: "진입가랑 청산가 거리 계산은 어떻게 하는 게 좋아요?" },
  { nickname: "펀딩비수집가", emoji: "🐙", body: "펀딩 0.01% 넘어가면 숏 보유가 오히려 이득" },
  { nickname: "존버장인", emoji: "🦁", body: "레버리지 낮추고 오래 가는 게 결국 남는 장사" },
  { nickname: "청산각", emoji: "🐺", body: "방금 SL 걸어뒀는데 털렸네요… 다시 롱" },
  { nickname: "개미1234", emoji: "🐜", body: "오늘은 수익 나면 바로 익절합니다" },
  { nickname: "ETH맥스", emoji: "🦄", body: "ETH 15분봉 쌍바닥 같기도" },
  { nickname: "비트맥스", emoji: "🐯", badge: "BTC 20x 롱 +12.8%", body: "BTC 20x 롱 진입. TP는 1.5% 위" },
  { nickname: "리스크관리자", emoji: "🐸", body: "한 번에 잔고 10% 이상 걸지 마세요. 진짜로" },
];
