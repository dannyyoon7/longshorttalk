import type { Interval, Symbol } from "@/lib/constants";
import type { FeedSource, FeedStatusInfo } from "./types";
import { SOURCE_LABEL } from "./types";
import type { AdapterHandlers, AdapterOptions, SourceAdapter } from "./adapter";
import { BinanceAdapter } from "./binance";
import { OkxAdapter } from "./okx";
import { DemoAdapter } from "./demo";

export type FeedHandlers = Omit<AdapterHandlers, "onStatus">;

const ENV_SOURCE = process.env.NEXT_PUBLIC_MARKET_SOURCE?.trim();

function sourceOrder(): FeedSource[] {
  if (ENV_SOURCE === "binance") return ["binance"];
  if (ENV_SOURCE === "okx") return ["okx"];
  if (ENV_SOURCE === "demo") return ["demo"];
  return ["binance", "okx", "demo"];
}

function createAdapter(name: FeedSource, options: AdapterOptions): SourceAdapter {
  if (name === "binance") return new BinanceAdapter(options);
  if (name === "okx") return new OkxAdapter(options);
  return new DemoAdapter(options);
}

/**
 * 바이낸스 → OKX → 데모 순서로 자동 전환하는 시세 피드.
 * 첫 소스가 지역 제한(451)·CORS·네트워크 문제로 실패하면 다음 소스로 넘어간다.
 */
export class MarketFeed {
  private symbol: Symbol;
  private interval: Interval;
  private readonly order: FeedSource[];
  private generation = 0;
  private adapter: SourceAdapter | null = null;
  private sourceIndex = 0;
  private stopped = false;
  private readonly handlers: FeedHandlers;
  private readonly onState: (info: FeedStatusInfo) => void;

  constructor(
    symbol: Symbol,
    interval: Interval,
    handlers: FeedHandlers,
    onState: (info: FeedStatusInfo) => void,
  ) {
    this.symbol = symbol;
    this.interval = interval;
    this.handlers = handlers;
    this.onState = onState;
    this.order = sourceOrder();
  }

  start(): void {
    this.stopped = false;
    void this.startFrom(0);
  }

  setMarket(symbol: Symbol, interval: Interval): void {
    if (this.symbol === symbol && this.interval === interval) return;
    this.symbol = symbol;
    this.interval = interval;
    this.generation += 1;
    this.adapter?.stop();
    this.adapter = null;
    void this.startFrom(this.sourceIndex);
  }

  stop(): void {
    this.stopped = true;
    this.generation += 1;
    this.adapter?.stop();
    this.adapter = null;
  }

  private makeHandlers(generation: number): AdapterHandlers {
    const alive = () => !this.stopped && generation === this.generation;
    return {
      onPrices: (patch) => {
        if (alive()) this.handlers.onPrices(patch);
      },
      onBook: (book) => {
        if (alive()) this.handlers.onBook(book);
      },
      onCandles: (candles) => {
        if (alive()) this.handlers.onCandles(candles);
      },
      onCandle: (candle) => {
        if (alive()) this.handlers.onCandle(candle);
      },
      onTrade: (trade) => {
        if (alive()) this.handlers.onTrade(trade);
      },
      onStatus: (info) => {
        if (alive()) this.onState(info);
      },
      onFatal: () => {
        if (alive()) this.failover(generation);
      },
    };
  }

  private failover(generation: number): void {
    if (this.stopped || generation !== this.generation) return;
    const nextIndex = this.sourceIndex + 1;
    this.adapter?.stop();
    this.adapter = null;
    void this.startFrom(nextIndex);
  }

  private async startFrom(index: number): Promise<void> {
    if (this.stopped) return;
    if (index >= this.order.length) {
      this.onState({
        status: "offline",
        source: "demo",
        note: "시세 서버에 연결할 수 없습니다. 네트워크를 확인해 주세요.",
      });
      return;
    }

    const source = this.order[index];
    const generation = ++this.generation;
    const handlers = this.makeHandlers(generation);
    this.onState({
      status: "connecting",
      source,
      note: `${SOURCE_LABEL[source]} 연결 중…`,
    });

    const adapter = createAdapter(source, {
      symbol: this.symbol,
      interval: this.interval,
      handlers,
    });
    this.adapter = adapter;

    try {
      await Promise.race([
        adapter.start(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("시세 연결 시간 초과")), 9000),
        ),
      ]);
      if (this.stopped || generation !== this.generation) return;
      this.sourceIndex = index;
    } catch (error) {
      if (process.env.NODE_ENV !== "production" || typeof window !== "undefined") {
        console.warn(`[market] ${source} 소스 연결 실패`, error);
      }
      adapter.stop();
      if (this.adapter === adapter) this.adapter = null;
      if (this.stopped || generation !== this.generation) return;
      void this.startFrom(index + 1);
    }
  }
}
