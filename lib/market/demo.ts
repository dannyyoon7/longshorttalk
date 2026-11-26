import { INTERVAL_SECONDS, SYMBOLS, SYMBOL_META, type Interval, type Symbol } from "@/lib/constants";
import type { AdapterHandlers, AdapterOptions, PricePatch, SourceAdapter } from "./adapter";
import type { Candle, OrderBookLevel, OrderBookSnapshot } from "./types";

const SEED: Record<Symbol, number> = { BTCUSDT: 60_900, ETHUSDT: 1_704 };

type DemoState = {
  price: number;
  open24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  candles: Candle[];
};

/**
 * 어떤 네트워크에서도 앱을 체험할 수 있게 하는 합성 시세.
 * UI에 '데모 시세'로 명확히 표시된다.
 */
export class DemoAdapter implements SourceAdapter {
  readonly name = "demo" as const;
  private readonly handlers: AdapterHandlers;
  private readonly symbol: Symbol;
  private readonly interval: Interval;
  private timer: ReturnType<typeof setInterval> | null = null;
  private stopped = false;
  private state: Record<Symbol, DemoState>;
  private tickCount = 0;

  constructor({ symbol, interval, handlers }: AdapterOptions) {
    this.symbol = symbol;
    this.interval = interval;
    this.handlers = handlers;
    const now = Date.now();
    this.state = {
      BTCUSDT: this.buildState("BTCUSDT", now),
      ETHUSDT: this.buildState("ETHUSDT", now),
    };
  }

  private buildState(symbol: Symbol, now: number): DemoState {
    const step = INTERVAL_SECONDS[this.interval];
    const base = SEED[symbol];
    const candles: Candle[] = [];
    let price = base * 0.985;
    const start = Math.floor(now / 1000) - step * 280;
    for (let i = 0; i < 280; i += 1) {
      const open = price;
      const drift = (Math.random() - 0.48) * base * 0.0022;
      const close = Math.max(open + drift, base * 0.5);
      const high = Math.max(open, close) + Math.random() * base * 0.0009;
      const low = Math.min(open, close) - Math.random() * base * 0.0009;
      candles.push({
        time: start + i * step,
        open,
        high,
        low,
        close,
        volume: 40 + Math.random() * 220,
      });
      price = close;
    }
    const last = candles[candles.length - 1];
    const open24h = base * (0.96 + Math.random() * 0.09);
    return {
      price: last.close,
      open24h,
      high24h: Math.max(...candles.map((c) => c.high)),
      low24h: Math.min(...candles.map((c) => c.low)),
      volume24h: base * (1500 + Math.random() * 3000),
      candles,
    };
  }

  async start(): Promise<void> {
    this.stopped = false;
    const iso = Math.floor(Date.now() / 1000);
    const step = INTERVAL_SECONDS[this.interval];

    for (const symbol of SYMBOLS) {
      const st = this.state[symbol];
      this.handlers.onPrices({
        [symbol]: {
          last: st.price,
          mark: st.price,
          changePct24h: ((st.price - st.open24h) / st.open24h) * 100,
          high24h: st.high24h,
          low24h: st.low24h,
          volume24h: st.volume24h,
          fundingRate: 0.0001,
          nextFundingTime: this.nextFunding(iso),
          updatedAt: Date.now(),
        },
      } as PricePatch);
    }

    const active = this.state[this.symbol];
    const last = active.candles[active.candles.length - 1];
    active.candles.push({
      time: Math.floor(iso / step) * step,
      open: last.close,
      high: last.close,
      low: last.close,
      close: last.close,
      volume: 10,
    });
    this.handlers.onCandles([...active.candles]);
    this.handlers.onBook(this.buildBook(this.symbol));
    this.handlers.onStatus({
      status: "demo",
      source: "demo",
      note: "데모 시세로 동작 중 · 실시간 거래소 연결 불가",
    });

    this.timer = setInterval(() => this.tick(), 700);
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private nextFunding(iso: number): number {
    const d = new Date(iso * 1000);
    const h = d.getUTCHours();
    const nextHour = h < 8 ? 8 : h < 16 ? 16 : 24;
    const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), nextHour, 0, 0));
    if (next.getTime() <= Date.now()) next.setUTCDate(next.getUTCDate() + 1);
    return next.getTime();
  }

  private tick(): void {
    if (this.stopped) return;
    this.tickCount += 1;
    const step = INTERVAL_SECONDS[this.interval];

    for (const symbol of SYMBOLS) {
      const st = this.state[symbol];
      const vol = st.price * 0.00045;
      const next = Math.max(st.price + (Math.random() - 0.5) * vol * 2, st.price * 0.98);
      st.price = next;
      st.high24h = Math.max(st.high24h, next);
      st.low24h = Math.min(st.low24h, next);
      this.handlers.onPrices({
        [symbol]: {
          last: next,
          mark: next * (1 + (Math.random() - 0.5) * 0.00002),
          changePct24h: ((next - st.open24h) / st.open24h) * 100,
          high24h: st.high24h,
          low24h: st.low24h,
          volume24h: st.volume24h,
          updatedAt: Date.now(),
        },
      } as PricePatch);
    }

    const active = this.state[this.symbol];
    const price = active.price;
    const bucket = Math.floor(Date.now() / 1000 / step) * step;
    const current = active.candles[active.candles.length - 1];
    if (bucket > current.time) {
      active.candles.push({
        time: bucket,
        open: current.close,
        high: price,
        low: price,
        close: price,
        volume: 5 + Math.random() * 15,
      });
      if (active.candles.length > 400) active.candles.shift();
      this.handlers.onCandle({ ...active.candles[active.candles.length - 1] });
    } else {
      current.close = price;
      current.high = Math.max(current.high, price);
      current.low = Math.min(current.low, price);
      current.volume += Math.random() * 0.8;
      this.handlers.onCandle({ ...current });
    }

    if (this.tickCount % 3 === 0) {
      this.handlers.onBook(this.buildBook(this.symbol));
      this.handlers.onTrade({
        id: `d_${Date.now()}_${this.tickCount}`,
        price,
        qty: Math.random() * 0.8 + 0.01,
        side: Math.random() > 0.5 ? "BUY" : "SELL",
        time: Date.now(),
      });
    }
  }

  private buildBook(symbol: Symbol): OrderBookSnapshot {
    const st = this.state[symbol];
    const meta = SYMBOL_META[symbol];
    const tick = Math.max(meta.tickSize, st.price * 0.00003);
    const bids: OrderBookLevel[] = [];
    const asks: OrderBookLevel[] = [];
    for (let i = 0; i < 10; i += 1) {
      bids.push({
        price: Number((st.price - tick * (i + 1)).toFixed(meta.pricePrecision)),
        qty: Number((Math.random() * 3 * (1 + i * 0.25) + 0.05).toFixed(3)),
      });
      asks.push({
        price: Number((st.price + tick * (i + 1)).toFixed(meta.pricePrecision)),
        qty: Number((Math.random() * 3 * (1 + i * 0.25) + 0.05).toFixed(3)),
      });
    }
    return { bids, asks, updatedAt: Date.now() };
  }
}
