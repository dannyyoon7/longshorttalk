export type RankedTrader = {
  id: string;
  nickname: string;
  emoji: string;
  weekly: number;
  allTime: number;
  winRate: number;
  trades: number;
  favorite: "BTC" | "ETH";
  leverage: number;
  tagline: string;
};

export const DEMO_TRADERS: RankedTrader[] = [
  { id: "t1", nickname: "청산각", emoji: "🦈", weekly: 412.6, allTime: 1284.3, winRate: 61, trades: 148, favorite: "BTC", leverage: 50, tagline: "숏 스캘핑 장인" },
  { id: "t2", nickname: "롱충이", emoji: "🐳", weekly: 268.4, allTime: 942.8, winRate: 57, trades: 96, favorite: "BTC", leverage: 20, tagline: "눌림목 롱만 봅니다" },
  { id: "t3", nickname: "이더리움신봉자", emoji: "🦄", weekly: 197.2, allTime: 731.5, winRate: 55, trades: 212, favorite: "ETH", leverage: 50, tagline: "ETH 단타 전문" },
  { id: "t4", nickname: "차트도사", emoji: "🦉", weekly: 154.8, allTime: 688.1, winRate: 63, trades: 74, favorite: "BTC", leverage: 10, tagline: "4시간봉 추세 추종" },
  { id: "t5", nickname: "스캘퍼김", emoji: "🦅", weekly: 121.3, allTime: 402.7, winRate: 58, trades: 331, favorite: "ETH", leverage: 25, tagline: "1분봉 스캘핑" },
  { id: "t6", nickname: "존버장인", emoji: "🦁", weekly: 88.9, allTime: 512.4, winRate: 52, trades: 28, favorite: "BTC", leverage: 10, tagline: "낮은 레버리지 장기 홀딩" },
  { id: "t7", nickname: "펀딩비수집가", emoji: "🐙", weekly: 64.1, allTime: 288.6, winRate: 66, trades: 51, favorite: "BTC", leverage: 5, tagline: "펀딩 헤지 전략" },
  { id: "t8", nickname: "비트맥스", emoji: "🐯", weekly: 42.7, allTime: 219.3, winRate: 49, trades: 187, favorite: "BTC", leverage: 20, tagline: "BTC 20x 단타" },
  { id: "t9", nickname: "리스크관리자", emoji: "🐸", weekly: 31.2, allTime: 176.9, winRate: 71, trades: 43, favorite: "ETH", leverage: 5, tagline: "손절이 곧 수익" },
  { id: "t10", nickname: "개미1234", emoji: "🐜", weekly: 18.5, allTime: 92.1, winRate: 48, trades: 120, favorite: "ETH", leverage: 3, tagline: "3배로만 갑니다" },
  { id: "t11", nickname: "숏충이", emoji: "🐺", weekly: -12.4, allTime: 64.8, winRate: 44, trades: 203, favorite: "BTC", leverage: 50, tagline: "하락장 전사" },
  { id: "t12", nickname: "초보탈출", emoji: "🐣", weekly: -24.8, allTime: 12.6, winRate: 41, trades: 37, favorite: "ETH", leverage: 10, tagline: "배우는 중입니다" },
  { id: "t13", nickname: "ETH맥스", emoji: "🦄", weekly: -38.2, allTime: 148.3, winRate: 39, trades: 164, favorite: "ETH", leverage: 25, tagline: "ETH만 봅니다" },
  { id: "t14", nickname: "롱숏고민중", emoji: "🐨", weekly: 7.4, allTime: 41.2, winRate: 50, trades: 18, favorite: "BTC", leverage: 10, tagline: "방향성 고민 중" },
];

export const LEADERBOARD_NOTE =
  "랭킹은 모의투자 기준 수익률입니다. 실제 수익이 아니며, 과거 성과가 미래 수익을 보장하지 않습니다.";
