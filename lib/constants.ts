export const SYMBOLS = ["BTCUSDT", "ETHUSDT"] as const;
export type Symbol = (typeof SYMBOLS)[number];

export const INTERVALS = ["1m", "5m", "15m", "1h", "4h", "1d"] as const;
export type Interval = (typeof INTERVALS)[number];

export type SymbolMeta = {
  symbol: Symbol;
  base: string;
  quote: string;
  name: string;
  koreanName: string;
  maxLeverage: number;
  pricePrecision: number;
  tickSize: number;
  qtyStep: number;
  minQty: number;
  minNotional: number;
};

export const SYMBOL_META: Record<Symbol, SymbolMeta> = {
  BTCUSDT: {
    symbol: "BTCUSDT",
    base: "BTC",
    quote: "USDT",
    name: "Bitcoin",
    koreanName: "비트코인",
    maxLeverage: 125,
    pricePrecision: 1,
    tickSize: 0.1,
    qtyStep: 0.001,
    minQty: 0.001,
    minNotional: 5,
  },
  ETHUSDT: {
    symbol: "ETHUSDT",
    base: "ETH",
    quote: "USDT",
    name: "Ethereum",
    koreanName: "이더리움",
    maxLeverage: 100,
    pricePrecision: 2,
    tickSize: 0.01,
    qtyStep: 0.001,
    minQty: 0.001,
    minNotional: 5,
  },
};

export const INTERVAL_LABEL: Record<Interval, string> = {
  "1m": "1분",
  "5m": "5분",
  "15m": "15분",
  "1h": "1시간",
  "4h": "4시간",
  "1d": "1일",
};

export const INTERVAL_SECONDS: Record<Interval, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1h": 3600,
  "4h": 14400,
  "1d": 86400,
};

/** 수수료 (바이낸스 USDT-M 선물 기준) */
export const TAKER_FEE_RATE = 0.0005;
export const MAKER_FEE_RATE = 0.0002;
/** 유지증거금률 (BTC/ETH 1단계 기준, 0.4%) */
export const MAINTENANCE_MARGIN_RATE = 0.004;

export const INITIAL_BALANCE = 10_000;
export const REFILL_AMOUNT = 10_000;
export const REFILL_THRESHOLD = 1_000;

export const FUNDING_INTERVAL_MS = 8 * 60 * 60 * 1000;

export const STORAGE_KEYS = {
  account: "lst:account:v1",
  profile: "lst:profile:v1",
  chat: "lst:chat:v1",
  community: "lst:community:v1",
  shareDraft: "lst:share-draft:v1",
} as const;

export const AD_SLOTS = {
  home: "home-bottom-banner",
  community: "community-sidebar",
  guide: "guide-bottom-banner",
} as const;
