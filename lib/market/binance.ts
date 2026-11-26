import { SYMBOLS, type Interval, type Symbol } from "@/lib/constants";
import type { AdapterHandlers, AdapterOptions, PricePatch, SourceAdapter } from "./adapter";
import { fetchJson } from "./adapter";
import type { Candle, OrderBookSnapshot } from "./types";

const REST = "https://fapi.binance.com";
const WS = "wss://fstream.binance.com/stream";

type BinanceKline = [
  number, // open time
  string,
  string,
  string,
  string,
  string,
  number,
  string,
  number,
  string,
  string,
  string,
];

type BinanceTicker = {
  c: string;
  P: string;
  h: string;
  l: string;
  q: string;
};

type BinancePremium = {
  markPrice: string;
  lastFundingRate: string;
  nextFundingTime: number;
};

type BinanceDepth = {
  b: [string, string][];
  a: [string, string][];
};

type BinanceKlineEvent = {
  k: { t: number; o: string; h: string; l: string; c: string; v: string };
};

type BinanceAggTrade = {
  a: number;
  p: string;
  q: string;
  m: boolean;
  T: number;
};

type BinanceMarkPrice = {
  s: string;
  p: string;
  r: string;
  T: number;
};

function toSymbol(stream: string): Symbol | null {
  const lower = stream.toLowerCase();
  for (const s of SYMBOLS) {
    if (lower.startsWith(s.toLowerCase())) return s;
  }
  return null;
}

function parseKline(row: BinanceKline): Candle {
  return {
    time: Math.floor(row[0] / 1000),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[5]),
  };
}

export class BinanceAdapter implements SourceAdapter {
  readonly name = "binance" as const;
  private ws: WebSocket | null = null;
  private stopped = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private watchdog: ReturnType<typeof setInterval> | null = null;
  private tickerPoll: ReturnType<typeof setInterval> | null = null;
  private depthPoll: ReturnType<typeof setInterval> | null = null;
  private klinePoll: ReturnType<typeof setInterval> | null = null;
  private lastMessageAt = 0;
  private restMode = false;
  private readonly handlers: AdapterHandlers;
  private readonly symbol: Symbol;
  private readonly interval: Interval;

  constructor({ symbol, interval, handlers }: AdapterOptions) {
    this.symbol = symbol;
    this.interval = interval;
    this.handlers = handlers;
  }

  async start(): Promise<void> {
    this.stopped = false;
    const [klines, ticker, premium] = await Promise.all([
      fetchJson<BinanceKline[]>(
        `${REST}/fapi/v1/klines?symbol=${this.symbol}&interval=${this.interval}&limit=400`,
      ),
      fetchJson<BinanceTicker>(`${REST}/fapi/v1/ticker/24hr?symbol=${this.symbol}`),
      fetchJson<BinancePremium>(`${REST}/fapi/v1/premiumIndex?symbol=${this.symbol}`),
    ]);

    this.handlers.onCandles(klines.map(parseKline));
    this.handlers.onPrices(this.tickerPatch(this.symbol, ticker));
    this.handlers.onPrices({
      [this.symbol]: {
        mark: Number(premium.markPrice),
        fundingRate: Number(premium.lastFundingRate),
        nextFundingTime: premium.nextFundingTime,
        updatedAt: Date.now(),
      },
    } as PricePatch);

    this.handlers.onStatus({
      status: "connecting",
      source: "binance",
      note: "Binance REST 로드 완료 · 실시간 스트림 연결 중",
    });

    // 웹소켓은 백그라운드로 연결한다.
    void this.connect()
      .then(() => {
        if (this.stopped) return;
        this.handlers.onStatus({
          status: "live",
          source: "binance",
          note: "Binance Futures 실시간",
        });
        this.watchdog = setInterval(() => {
          if (this.stopped) return;
          if (this.lastMessageAt && Date.now() - this.lastMessageAt > 45000) {
            this.forceReconnect();
          }
        }, 10000);
      })
      .catch(() => {
        if (this.stopped) return;
        // REST는 되는데 웹소켓이 막힌 경우: 2초 폴링으로 계속 실시간에 가깝게 유지
        this.restMode = true;
        try {
          this.ws?.close();
        } catch {
          /* noop */
        }
        this.ws = null;
        this.startRestPolling();
        this.handlers.onStatus({
          status: "live",
          source: "binance",
          note: "Binance REST 폴링 모드 · 웹소켓 차단",
        });
      });
  }

  private startRestPolling(): void {
    this.tickerPoll = setInterval(() => void this.refreshTickers(), 2500);
    this.depthPoll = setInterval(() => void this.refreshDepth(), 1200);
    this.klinePoll = setInterval(() => void this.refreshLastCandle(), 3000);
  }

  private async refreshTickers(): Promise<void> {
    if (this.stopped) return;
    try {
      const patches: PricePatch = {};
      await Promise.all(
        SYMBOLS.map(async (symbol) => {
          const [ticker, premium] = await Promise.all([
            fetchJson<BinanceTicker>(`${REST}/fapi/v1/ticker/24hr?symbol=${symbol}`),
            fetchJson<BinancePremium>(`${REST}/fapi/v1/premiumIndex?symbol=${symbol}`),
          ]);
          patches[symbol] = {
            ...this.tickerPatch(symbol, ticker)[symbol],
            mark: Number(premium.markPrice),
            fundingRate: Number(premium.lastFundingRate),
            nextFundingTime: premium.nextFundingTime,
            updatedAt: Date.now(),
          };
        }),
      );
      if (!this.stopped) this.handlers.onPrices(patches);
    } catch {
      /* 다음 주기 재시도 */
    }
  }

  private async refreshDepth(): Promise<void> {
    if (this.stopped) return;
    try {
      const depth = await fetchJson<BinanceDepth>(
        `${REST}/fapi/v1/depth?symbol=${this.symbol}&limit=10`,
      );
      this.emitDepth(depth);
    } catch {
      /* noop */
    }
  }

  private async refreshLastCandle(): Promise<void> {
    if (this.stopped) return;
    try {
      const rows = await fetchJson<BinanceKline[]>(
        `${REST}/fapi/v1/klines?symbol=${this.symbol}&interval=${this.interval}&limit=2`,
      );
      if (rows.length) this.handlers.onCandle(parseKline(rows[rows.length - 1]));
    } catch {
      /* noop */
    }
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.watchdog) clearInterval(this.watchdog);
    if (this.tickerPoll) clearInterval(this.tickerPoll);
    if (this.depthPoll) clearInterval(this.depthPoll);
    if (this.klinePoll) clearInterval(this.klinePoll);
    this.reconnectTimer = null;
    this.watchdog = null;
    this.tickerPoll = null;
    this.depthPoll = null;
    this.klinePoll = null;
    try {
      this.ws?.close();
    } catch {
      /* noop */
    }
    this.ws = null;
  }

  private streams(): string[] {
    const sym = this.symbol.toLowerCase();
    const streams = [
      `${sym}@ticker`,
      `${sym}@aggTrade`,
      `${sym}@markPrice@1s`,
      `${sym}@depth10@100ms`,
      `${sym}@kline_${this.interval}`,
    ];
    for (const other of SYMBOLS) {
      if (other === this.symbol) continue;
      const o = other.toLowerCase();
      streams.push(`${o}@ticker`, `${o}@markPrice@1s`);
    }
    return streams;
  }

  private connect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (this.stopped) {
        reject(new Error("stopped"));
        return;
      }
      let settled = false;
      const url = `${WS}?streams=${this.streams().join("/")}`;
      let socket: WebSocket;
      try {
        socket = new WebSocket(url);
      } catch (err) {
        reject(err);
        return;
      }
      this.ws = socket;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          try {
            socket.close();
          } catch {
            /* noop */
          }
          reject(new Error("binance ws timeout"));
        }
      }, 5000);

      socket.onopen = () => {
        clearTimeout(timer);
        this.reconnectAttempts = 0;
        this.lastMessageAt = Date.now();
        if (!settled) {
          settled = true;
          resolve();
        } else {
          this.handlers.onStatus({ status: "live", source: "binance", note: "Binance Futures 실시간" });
        }
      };

      socket.onmessage = (event) => {
        this.lastMessageAt = Date.now();
        this.handleMessage(event.data);
      };

      socket.onerror = () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(new Error("binance ws error"));
        }
      };

      socket.onclose = () => {
        if (settled) {
          settled = true;
          clearTimeout(timer);
          reject(new Error("binance ws closed"));
          return;
        }
        if (this.stopped || this.restMode) return;
        this.scheduleReconnect();
      };
    });
  }

  private scheduleReconnect(): void {
    if (this.stopped) return;
    this.reconnectAttempts += 1;
    if (this.reconnectAttempts > 8) {
      this.handlers.onFatal("바이낸스 실시간 연결 실패");
      return;
    }
    const delay = Math.min(1000 * 2 ** (this.reconnectAttempts - 1), 6000);
    this.handlers.onStatus({
      status: "reconnecting",
      source: "binance",
      note: `재연결 시도 ${this.reconnectAttempts}/8`,
    });
    this.reconnectTimer = setTimeout(() => {
      void this.connect().catch(() => this.scheduleReconnect());
    }, delay);
  }

  private forceReconnect(): void {
    try {
      this.ws?.close();
    } catch {
      /* noop */
    }
    this.ws = null;
    this.scheduleReconnect();
  }

  private tickerPatch(symbol: Symbol, t: BinanceTicker): PricePatch {
    return {
      [symbol]: {
        last: Number(t.c),
        changePct24h: Number(t.P),
        high24h: Number(t.h),
        low24h: Number(t.l),
        volume24h: Number(t.q),
        updatedAt: Date.now(),
      },
    } as PricePatch;
  }

  private emitDepth(d: BinanceDepth): void {
    const book: OrderBookSnapshot = {
      bids: d.b
        .map(([p, q]) => ({ price: Number(p), qty: Number(q) }))
        .filter((l) => l.qty > 0)
        .sort((a, b) => b.price - a.price)
        .slice(0, 10),
      asks: d.a
        .map(([p, q]) => ({ price: Number(p), qty: Number(q) }))
        .filter((l) => l.qty > 0)
        .sort((a, b) => a.price - b.price)
        .slice(0, 10),
      updatedAt: Date.now(),
    };
    this.handlers.onBook(book);
  }

  private handleMessage(raw: unknown): void {
    if (typeof raw !== "string") return;
    let msg: { stream?: string; data?: unknown };
    try {
      msg = JSON.parse(raw) as { stream?: string; data?: unknown };
    } catch {
      return;
    }
    if (!msg.stream || !msg.data) return;
    const symbol = toSymbol(msg.stream);
    if (!symbol) return;
    const data = msg.data;

    if (msg.stream.endsWith("@ticker")) {
      this.handlers.onPrices(this.tickerPatch(symbol, data as BinanceTicker));
      return;
    }

    if (msg.stream.includes("@markPrice")) {
      const mp = data as BinanceMarkPrice;
      this.handlers.onPrices({
        [symbol]: {
          mark: Number(mp.p),
          fundingRate: Number(mp.r),
          nextFundingTime: mp.T,
          updatedAt: Date.now(),
        },
      } as PricePatch);
      return;
    }

    if (msg.stream.endsWith("@aggTrade")) {
      const at = data as BinanceAggTrade;
      const price = Number(at.p);
      this.handlers.onPrices({ [symbol]: { last: price, updatedAt: Date.now() } } as PricePatch);
      this.handlers.onTrade({
        id: `b_${at.a}`,
        price,
        qty: Number(at.q),
        side: at.m ? "SELL" : "BUY",
        time: at.T,
      });
      return;
    }

    if (msg.stream.includes("@depth")) {
      this.emitDepth(data as BinanceDepth);
      return;
    }

    if (msg.stream.includes("@kline_")) {
      const ev = data as BinanceKlineEvent;
      this.handlers.onCandle({
        time: Math.floor(ev.k.t / 1000),
        open: Number(ev.k.o),
        high: Number(ev.k.h),
        low: Number(ev.k.l),
        close: Number(ev.k.c),
        volume: Number(ev.k.v),
      });
    }
  }
}
