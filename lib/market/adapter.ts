import type { Interval, Symbol } from "@/lib/constants";
import type { Candle, FeedSource, FeedStatusInfo, OrderBookSnapshot, RecentTrade, Ticker } from "./types";

export type PricePatch = Partial<Record<Symbol, Partial<Ticker>>>;

export type AdapterHandlers = {
  onPrices: (patch: PricePatch) => void;
  onBook: (book: OrderBookSnapshot) => void;
  onCandles: (candles: Candle[]) => void;
  onCandle: (candle: Candle) => void;
  onTrade: (trade: RecentTrade) => void;
  onStatus: (info: FeedStatusInfo) => void;
  onFatal: (reason: string) => void;
};

export type AdapterOptions = {
  symbol: Symbol;
  interval: Interval;
  handlers: AdapterHandlers;
};

export interface SourceAdapter {
  readonly name: FeedSource;
  start(): Promise<void>;
  stop(): void;
}

export async function fetchJson<T>(url: string, timeoutMs = 7000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}
