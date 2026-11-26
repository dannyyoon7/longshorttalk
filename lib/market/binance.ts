import { SYMBOLS, type Interval, type Symbol } from "@/lib/constants";
import type { AdapterHandlers, AdapterOptions, PricePatch, SourceAdapter } from "./adapter";
import { fetchJson } from "./adapter";
import { LiveCandleBuilder, firstNum, toNum } from "./liveCandle";
import type { Candle, OrderBookSnapshot, Ticker } from "./types";

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

/**
 * /fapi/v1/ticker/24hr 응답은 예전 축약 키(c, P, h, l, q)와
 * 현재 긴 이름 키(lastPrice, priceChangePercent, …)가 섞여 내려올 수 있어
 * 둘 다 읽는다. (축약 키만 읽어 24시간 정보가 '—'로 남던 원인)
 */
type BinanceTicker = {
  c?: string;
  P?: string;
  h?: string;
  l?: string;
  q?: string;
  o?: string;
  v?: string;
  lastPrice?: string;
  priceChangePercent?: string;
  highPrice?: string;
  lowPrice?: string;
  quoteVolume?: string;
  volume?: string;
  openPrice?: string;
};

type BinancePremium = {
  markPrice: string;
  lastFundingRate: string;
  nextFundingTime: number;
};

type BinanceDepth = {
  b: [string, string][];
  a: [string, string][];
  /** 거래소 이벤트/거래 시각 (ms) — 로컬 시계 오차와 무관하게 봉 시각을 맞춘다 */
  T?: number;
  E?: number;
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

type BinanceBookTicker = {
  s?: string;
  b?: string;
  a?: string;
  T?: number;
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
    open: toNum(row[1]),
    high: toNum(row[2]),
    low: toNum(row[3]),
    close: toNum(row[4]),
    volume: toNum(row[5]),
  };
}

const TICK_THROTTLE_MS = 180;

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
  private lastTickAt = 0;
  private restMode = false;
  private readonly handlers: AdapterHandlers;
  private readonly symbol: Symbol;
  private readonly interval: Interval;
  private readonly candles: LiveCandleBuilder;

  constructor({ symbol, interval, handlers }: AdapterOptions) {
    this.symbol = symbol;
    this.interval = interval;
    this.handlers = handlers;
    this.candles = new LiveCandleBuilder(interval);
  }

  async start(): Promise<void> {
    this.stopped = false;

    // 한 엔드포인트가 막혀도 나머지 데이터로 화면을 채운다.
    const [klinesRes, tickerRes, premiumRes] = await Promise.allSettled([
      fetchJson<BinanceKline[]>(
        `${REST}/fapi/v1/klines?symbol=${this.symbol}&interval=${this.interval}&limit=400`,
      ),
      fetchJson<BinanceTicker>(`${REST}/fapi/v1/ticker/24hr?symbol=${this.symbol}`),
      fetchJson<BinancePremium>(`${REST}/fapi/v1/premiumIndex?symbol=${this.symbol}`),
    ]);

    let loaded = false;

    if (klinesRes.status === "fulfilled" && Array.isArray(klinesRes.value)) {
      const candles = klinesRes.value.map(parseKline).filter((c) => Number.isFinite(c.close));
      if (candles.length > 0) {
        this.candles.seed(candles);
        this.handlers.onCandles(candles);
        this.handlers.onPrices({
          [this.symbol]: { last: candles[candles.length - 1].close, updatedAt: Date.now() },
        } as PricePatch);
        loaded = true;
      }
    }

    if (tickerRes.status === "fulfilled" && tickerRes.value) {
      const patch = this.tickerPatch(this.symbol, tickerRes.value);
      if (Object.keys(patch[this.symbol] ?? {}).length > 0) {
        this.handlers.onPrices(patch);
        loaded = true;
      }
    }

    if (premiumRes.status === "fulfilled" && premiumRes.value) {
      const mark = toNum(premiumRes.value.markPrice);
      const funding = toNum(premiumRes.value.lastFundingRate);
      const patch: PricePatch = { [this.symbol]: { updatedAt: Date.now() } };
      if (Number.isFinite(mark)) patch[this.symbol]!.mark = mark;
      if (Number.isFinite(funding)) patch[this.symbol]!.fundingRate = funding;
      if (Number.isFinite(premiumRes.value.nextFundingTime)) {
        patch[this.symbol]!.nextFundingTime = premiumRes.value.nextFundingTime;
      }
      this.handlers.onPrices(patch);
      loaded = true;
    }

    if (!loaded) {
      // 모든 REST가 실패한 경우에만 다음 소스(OKX → 데모)로 넘긴다.
      throw new Error("binance rest failed");
    }

    this.handlers.onStatus({
      status: "connecting",
      source: "binance",
      note: "Binance REST 로드 완료 · 실시간 스트림 연결 중",
    });

    // 캔들·24시간 정보는 웹소켓과 별개로 주기적으로 보정한다.
    // (kline/aggTrade 스트림이 조용한 환경에서도 차트가 멈추지 않게 하는 안전망)
    this.startPolling(false);

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
        // REST는 되는데 웹소켓이 막힌 경우: REST 폴링만으로 계속 실시간에 가깝게 유지
        this.restMode = true;
        try {
          this.ws?.close();
        } catch {
          /* noop */
        }
        this.ws = null;
        this.startPolling(true);
        this.handlers.onStatus({
          status: "live",
          source: "binance",
          note: "Binance REST 폴링 모드 · 웹소켓 차단",
        });
      });
  }

  private startPolling(fast: boolean): void {
    this.stopPolling();
    this.tickerPoll = setInterval(() => void this.refreshTickers(), fast ? 2500 : 15000);
    this.klinePoll = setInterval(() => void this.refreshLastCandle(), fast ? 2000 : 3000);
    if (fast) {
      this.depthPoll = setInterval(() => void this.refreshDepth(), 1200);
    }
  }

  private stopPolling(): void {
    if (this.tickerPoll) clearInterval(this.tickerPoll);
    if (this.depthPoll) clearInterval(this.depthPoll);
    if (this.klinePoll) clearInterval(this.klinePoll);
    this.tickerPoll = null;
    this.depthPoll = null;
    this.klinePoll = null;
  }

  private async refreshTickers(): Promise<void> {
    if (this.stopped) return;
    try {
      const patches: PricePatch = {};
      await Promise.all(
        SYMBOLS.map(async (symbol) => {
          try {
            const [ticker, premium] = await Promise.all([
              fetchJson<BinanceTicker>(`${REST}/fapi/v1/ticker/24hr?symbol=${symbol}`),
              fetchJson<BinancePremium>(`${REST}/fapi/v1/premiumIndex?symbol=${symbol}`),
            ]);
            const patch: Partial<Ticker> = {
              ...this.tickerPatch(symbol, ticker)[symbol],
              updatedAt: Date.now(),
            };
            const mark = toNum(premium.markPrice);
            const funding = toNum(premium.lastFundingRate);
            if (Number.isFinite(mark)) patch.mark = mark;
            if (Number.isFinite(funding)) patch.fundingRate = funding;
            if (Number.isFinite(premium.nextFundingTime)) {
              patch.nextFundingTime = premium.nextFundingTime;
            }
            patches[symbol] = patch;
          } catch {
            /* 이 심볼은 다음 주기에 재시도 */
          }
        }),
      );
      if (!this.stopped && Object.keys(patches).length > 0) this.handlers.onPrices(patches);
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
      const last = rows.length ? parseKline(rows[rows.length - 1]) : null;
      if (!last || !Number.isFinite(last.close)) return;
      const merged = this.candles.merge(last);
      if (merged) this.handlers.onCandle(merged);
      this.emitTick(last.close, Date.now(), 0, false);
    } catch {
      /* noop */
    }
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.watchdog) clearInterval(this.watchdog);
    this.stopPolling();
    this.reconnectTimer = null;
    this.watchdog = null;
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
      `${sym}@bookTicker`,
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
        clearTimeout(timer);
        if (!settled) {
          settled = true;
          reject(new Error("binance ws closed"));
          return;
        }
        if (this.stopped || this.restMode) return;
        this.handlers.onStatus({
          status: "reconnecting",
          source: "binance",
          note: "실시간 연결이 끊겼습니다. 재연결 중…",
        });
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

  /**
   * 24시간 시세 패치. 응답에 없는 값은 NaN이므로 필드에 넣지 않아
   * 기존 값을 덮어쓰지 않는다.
   */
  private tickerPatch(symbol: Symbol, t: BinanceTicker): PricePatch {
    const patch: Partial<Ticker> = { updatedAt: Date.now() };
    const last = firstNum(t.lastPrice, t.c);
    const high = firstNum(t.highPrice, t.h);
    const low = firstNum(t.lowPrice, t.l);
    const quoteVolume = firstNum(t.quoteVolume, t.q);
    const open = firstNum(t.openPrice, t.o);
    let changePct = firstNum(t.priceChangePercent, t.P);
    if (!Number.isFinite(changePct) && open > 0 && Number.isFinite(last)) {
      changePct = ((last - open) / open) * 100;
    }
    if (Number.isFinite(last)) patch.last = last;
    if (Number.isFinite(high)) patch.high24h = high;
    if (Number.isFinite(low)) patch.low24h = low;
    if (Number.isFinite(quoteVolume)) patch.volume24h = quoteVolume;
    if (Number.isFinite(changePct)) patch.changePct24h = changePct;
    return { [symbol]: patch } as PricePatch;
  }

  private emitDepth(d: BinanceDepth): void {
    const bids = (d.b ?? [])
      .map(([p, q]) => ({ price: toNum(p), qty: toNum(q) }))
      .filter((l) => l.qty > 0 && Number.isFinite(l.price))
      .sort((a, b) => b.price - a.price)
      .slice(0, 10);
    const asks = (d.a ?? [])
      .map(([p, q]) => ({ price: toNum(p), qty: toNum(q) }))
      .filter((l) => l.qty > 0 && Number.isFinite(l.price))
      .sort((a, b) => a.price - b.price)
      .slice(0, 10);
    const book: OrderBookSnapshot = { bids, asks, updatedAt: Date.now() };
    this.handlers.onBook(book);

    const bestBid = bids[0]?.price;
    const bestAsk = asks[0]?.price;
    if (Number.isFinite(bestBid) && Number.isFinite(bestAsk) && bestBid > 0 && bestAsk > 0) {
      const eventTime = Number.isFinite(d.T) ? Number(d.T) : Number.isFinite(d.E) ? Number(d.E) : Date.now();
      this.emitTick((bestBid + bestAsk) / 2, eventTime, 0, true);
    }
  }

  /**
   * 체결/호가 틱을 가격(last)과 진행 중인 캔들에 반영한다.
   * 180ms 스로틀을 두어 초당 수십 건의 호가 갱신이 화면을 과도하게
   * 다시 그리지 않도록 한다.
   */
  private emitTick(price: number, timeMs: number, qty: number, throttled = true): void {
    if (!Number.isFinite(price) || price <= 0) return;
    const now = Date.now();
    if (throttled && now - this.lastTickAt < TICK_THROTTLE_MS) return;
    this.lastTickAt = now;

    this.handlers.onPrices({
      [this.symbol]: { last: price, updatedAt: now },
    } as PricePatch);

    for (const candle of this.candles.push(price, timeMs, qty)) {
      this.handlers.onCandle(candle);
    }
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

    if (msg.stream.endsWith("@bookTicker")) {
      const bt = data as BinanceBookTicker;
      if (symbol === this.symbol) {
        const bid = toNum(bt.b);
        const ask = toNum(bt.a);
        if (bid > 0 && ask > 0) this.emitTick((bid + ask) / 2, bt.T ?? Date.now(), 0);
      }
      return;
    }

    if (msg.stream.endsWith("@ticker")) {
      this.handlers.onPrices(this.tickerPatch(symbol, data as BinanceTicker));
      const last = firstNum((data as BinanceTicker).lastPrice, (data as BinanceTicker).c);
      if (symbol === this.symbol && Number.isFinite(last)) {
        this.emitTick(last, Date.now(), 0);
      }
      return;
    }

    if (msg.stream.includes("@markPrice")) {
      const mp = data as BinanceMarkPrice;
      const mark = toNum(mp.p);
      const funding = toNum(mp.r);
      const patch: PricePatch = { [symbol]: { updatedAt: Date.now() } };
      if (Number.isFinite(mark)) patch[symbol]!.mark = mark;
      if (Number.isFinite(funding)) patch[symbol]!.fundingRate = funding;
      if (Number.isFinite(mp.T)) patch[symbol]!.nextFundingTime = mp.T;
      this.handlers.onPrices(patch);
      return;
    }

    if (msg.stream.endsWith("@aggTrade")) {
      const at = data as BinanceAggTrade;
      const price = toNum(at.p);
      const qty = toNum(at.q);
      const time = Number.isFinite(at.T) ? at.T : Date.now();
      this.handlers.onPrices({ [symbol]: { last: price, updatedAt: Date.now() } } as PricePatch);
      this.handlers.onTrade({
        id: `b_${at.a}`,
        price,
        qty,
        side: at.m ? "SELL" : "BUY",
        time,
      });
      if (symbol === this.symbol) this.emitTick(price, time, qty, false);
      return;
    }

    if (msg.stream.includes("@depth")) {
      if (symbol === this.symbol) this.emitDepth(data as BinanceDepth);
      return;
    }

    if (msg.stream.includes("@kline_")) {
      const ev = data as BinanceKlineEvent;
      if (symbol !== this.symbol) return;
      const candle: Candle = {
        time: Math.floor(ev.k.t / 1000),
        open: toNum(ev.k.o),
        high: toNum(ev.k.h),
        low: toNum(ev.k.l),
        close: toNum(ev.k.c),
        volume: toNum(ev.k.v),
      };
      const merged = this.candles.merge(candle);
      if (merged) this.handlers.onCandle(merged);
      this.handlers.onPrices({
        [this.symbol]: { last: candle.close, updatedAt: Date.now() },
      } as PricePatch);
    }
  }
}
