import type { Interval, Symbol } from "@/lib/constants";

export type Candle = {
  /** unix seconds (UTC) */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type Ticker = {
  last: number;
  mark: number;
  changePct24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  fundingRate: number;
  /** ms epoch, next funding settlement */
  nextFundingTime: number;
  updatedAt: number;
};

export type PriceMap = Record<Symbol, Ticker>;

export type OrderBookLevel = { price: number; qty: number };

export type OrderBookSnapshot = {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  updatedAt: number;
};

export type RecentTrade = {
  id: string;
  price: number;
  qty: number;
  side: "BUY" | "SELL";
  time: number;
};

export type FeedSource = "binance" | "okx" | "demo";
export type FeedStatus = "connecting" | "live" | "reconnecting" | "offline" | "demo";

export type FeedStatusInfo = {
  status: FeedStatus;
  source: FeedSource;
  note?: string;
};

export type MarketSnapshot = {
  symbol: Symbol;
  interval: Interval;
  prices: PriceMap;
  book: OrderBookSnapshot;
  trades: RecentTrade[];
  status: FeedStatus;
  source: FeedSource;
  note?: string;
};

export const EMPTY_TICKER: Ticker = {
  last: 0,
  mark: 0,
  changePct24h: 0,
  high24h: 0,
  low24h: 0,
  volume24h: 0,
  fundingRate: 0,
  nextFundingTime: 0,
  updatedAt: 0,
};

export const EMPTY_BOOK: OrderBookSnapshot = { bids: [], asks: [], updatedAt: 0 };

export const SOURCE_LABEL: Record<FeedSource, string> = {
  binance: "Binance Futures",
  okx: "OKX Perpetual",
  demo: "데모 시세",
};
