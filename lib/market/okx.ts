import { SYMBOLS, type Interval, type Symbol } from "@/lib/constants";
import type { AdapterHandlers, AdapterOptions, PricePatch, SourceAdapter } from "./adapter";
import { fetchJson } from "./adapter";
import { LiveCandleBuilder, firstNum, toNum } from "./liveCandle";
import type { Candle, OrderBookLevel, OrderBookSnapshot, Ticker } from "./types";

const REST = "https://www.okx.com";
const WS = "wss://ws.okx.com:8443/ws/v5/public";

const BAR_MAP: Record<Interval, string> = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "1h": "1H",
  "4h": "4H",
  "1d": "1D",
};

type OkxResponse<T> = { code: string; msg?: string; data: T };

type OkxTicker = {
  instId: string;
  last: string;
  open24h: string;
  high24h: string;
  low24h: string;
  vol24h: string;
  volCcy24h: string;
  ts: string;
};

type OkxFunding = { fundingRate: string; nextFundingTime: string; fundingTime: string };

type OkxCandleRow = [string, string, string, string, string, string, string, string, string];

type OkxBooks = { bids: [string, string, string, string][]; asks: [string, string, string, string][] };

function instId(symbol: Symbol): string {
  return symbol === "BTCUSDT" ? "BTC-USDT-SWAP" : "ETH-USDT-SWAP";
}

function symbolFromInst(id: string): Symbol | null {
  if (id.startsWith("BTC")) return "BTCUSDT";
  if (id.startsWith("ETH")) return "ETHUSDT";
  return null;
}

function parseLevels(rows: [string, string, string, string][]): OrderBookLevel[] {
  return rows
    .map(([px, sz]) => ({ price: Number(px), qty: Number(sz) }))
    .filter((l) => l.qty > 0);
}

function mergeLevels(a: OrderBookLevel[], b: OrderBookLevel[], side: "bid" | "ask"): OrderBookLevel[] {
  const map = new Map<number, number>();
  for (const level of [...a, ...b]) map.set(level.price, level.qty);
  const merged = Array.from(map, ([price, qty]) => ({ price, qty }));
  merged.sort((x, y) => (side === "bid" ? y.price - x.price : x.price - y.price));
  return merged.slice(0, 10);
}

export class OkxAdapter implements SourceAdapter {
  readonly name = "okx" as const;
  private ws: WebSocket | null = null;
  private stopped = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private bookPoll: ReturnType<typeof setInterval> | null = null;
  private fundingPoll: ReturnType<typeof setInterval> | null = null;
  private tickerPoll: ReturnType<typeof setInterval> | null = null;
  private candlePoll: ReturnType<typeof setInterval> | null = null;
  private lastMessageAt = 0;
  private restMode = false;
  private restBids: OrderBookLevel[] = [];
  private restAsks: OrderBookLevel[] = [];
  private wsBids: OrderBookLevel[] = [];
  private wsAsks: OrderBookLevel[] = [];
  private lastTickAt = 0;
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
    const bar = BAR_MAP[this.interval];
    const activeInst = instId(this.symbol);

    const [candles, ticker, books, mark] = await Promise.all([
      this.request<OkxCandleRow[]>(
        `/api/v5/market/candles?instId=${activeInst}&bar=${bar}&limit=300`,
      ),
      this.request<OkxTicker[]>(`/api/v5/market/ticker?instId=${activeInst}`),
      this.request<OkxBooks[]>(`/api/v5/market/books?instId=${activeInst}&sz=10`),
      this.request<{ markPx: string }[]>(`/api/v5/public/mark-price?instId=${activeInst}`),
    ]);

    const parsedCandles = candles
      .map((row) => ({
        time: Math.floor(Number(row[0]) / 1000),
        open: toNum(row[1]),
        high: toNum(row[2]),
        low: toNum(row[3]),
        close: toNum(row[4]),
        volume: toNum(row[6]),
      }))
      .filter((row) => Number.isFinite(row.close))
      .sort((a, b) => a.time - b.time);
    if (parsedCandles.length > 0) {
      this.candles.seed(parsedCandles);
      this.handlers.onCandles(parsedCandles);
      this.handlers.onPrices({
        [this.symbol]: {
          last: parsedCandles[parsedCandles.length - 1].close,
          updatedAt: Date.now(),
        },
      } as PricePatch);
    }

    if (ticker[0]) {
      this.handlers.onPrices(this.tickerPatch(this.symbol, ticker[0]));
      const last = firstNum(ticker[0].last);
      if (Number.isFinite(last)) this.emitTick(last, Date.now(), 0, false);
    }
    if (mark[0]) {
      this.handlers.onPrices({
        [this.symbol]: { mark: Number(mark[0].markPx), updatedAt: Date.now() },
      } as PricePatch);
    }
    if (books[0]) {
      this.restBids = parseLevels(books[0].bids);
      this.restAsks = parseLevels(books[0].asks);
      this.emitBook();
    }
    await this.refreshFunding();

    // 호가·펀딩·캔들은 웹소켓과 무관하게 REST로도 계속 갱신한다.
    // (candle/trades 스트림이 조용한 환경에서도 차트가 멈추지 않게 하는 안전망)
    this.bookPoll = setInterval(() => void this.pollBooks(), 900);
    this.fundingPoll = setInterval(() => void this.refreshFunding(), 60000);
    this.startRestPolling(false);

    this.handlers.onStatus({
      status: "connecting",
      source: "okx",
      note: "OKX REST 로드 완료 · 실시간 스트림 연결 중",
    });

    // 웹소켓은 백그라운드로 연결한다. (초기 차트는 REST 데이터로 이미 그려진 상태)
    void this.connect()
      .then(() => {
        if (this.stopped) return;
        this.startHeartbeat();
        this.handlers.onStatus({
          status: "live",
          source: "okx",
          note: "OKX 무기한 선물 실시간 (바이낸스 대체 피드)",
        });
      })
      .catch(() => {
        if (this.stopped) return;
        // 웹소켓 포트(8443)가 막힌 네트워크: REST 폴링으로 실시간에 가깝게 유지
        this.restMode = true;
        try {
          this.ws?.close();
        } catch {
          /* noop */
        }
        this.ws = null;
        this.startRestPolling(true);
        this.handlers.onStatus({
          status: "live",
          source: "okx",
          note: "OKX REST 폴링 모드 · 웹소켓 차단",
        });
      });
  }

  private startHeartbeat(): void {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = setInterval(() => {
      if (this.stopped) return;
      if (this.lastMessageAt && Date.now() - this.lastMessageAt > 40000) {
        this.forceReconnect();
        return;
      }
      try {
        this.ws?.send("ping");
      } catch {
        /* noop */
      }
    }, 20000);
  }

  private startRestPolling(fast: boolean): void {
    if (this.tickerPoll) clearInterval(this.tickerPoll);
    if (this.candlePoll) clearInterval(this.candlePoll);
    this.tickerPoll = setInterval(() => void this.refreshTickers(), fast ? 2000 : 8000);
    this.candlePoll = setInterval(() => void this.refreshLastCandle(), fast ? 2000 : 4000);
  }

  private async refreshTickers(): Promise<void> {
    if (this.stopped) return;
    try {
      const patches: PricePatch = {};
      await Promise.all(
        SYMBOLS.map(async (symbol) => {
          const rows = await this.request<OkxTicker[]>(
            `/api/v5/market/ticker?instId=${instId(symbol)}`,
          );
          if (rows[0]) patches[symbol] = this.tickerPatch(symbol, rows[0])[symbol];
        }),
      );
      const mark = await this.request<{ markPx: string }[]>(
        `/api/v5/public/mark-price?instId=${instId(this.symbol)}`,
      );
      if (mark[0]) {
        patches[this.symbol] = {
          ...patches[this.symbol],
          mark: Number(mark[0].markPx),
          updatedAt: Date.now(),
        };
      }
      if (!this.stopped) this.handlers.onPrices(patches);
    } catch {
      /* 다음 주기 재시도 */
    }
  }

  private async refreshLastCandle(): Promise<void> {
    if (this.stopped) return;
    try {
      const rows = await this.request<OkxCandleRow[]>(
        `/api/v5/market/candles?instId=${instId(this.symbol)}&bar=${BAR_MAP[this.interval]}&limit=2`,
      );
      if (rows[0]) {
        const candle: Candle = {
          time: Math.floor(Number(rows[0][0]) / 1000),
          open: toNum(rows[0][1]),
          high: toNum(rows[0][2]),
          low: toNum(rows[0][3]),
          close: toNum(rows[0][4]),
          volume: toNum(rows[0][6]),
        };
        const merged = this.candles.merge(candle);
        if (merged) this.handlers.onCandle(merged);
        this.emitTick(candle.close, Date.now(), 0, false);
      }
    } catch {
      /* noop */
    }
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.bookPoll) clearInterval(this.bookPoll);
    if (this.fundingPoll) clearInterval(this.fundingPoll);
    if (this.tickerPoll) clearInterval(this.tickerPoll);
    if (this.candlePoll) clearInterval(this.candlePoll);
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.reconnectTimer = null;
    this.bookPoll = null;
    this.fundingPoll = null;
    this.tickerPoll = null;
    this.candlePoll = null;
    this.heartbeat = null;
    try {
      this.ws?.close();
    } catch {
      /* noop */
    }
    this.ws = null;
  }

  private async request<T>(path: string): Promise<T> {
    const res = await fetchJson<OkxResponse<T>>(`${REST}${path}`, 7000);
    if (res.code !== "0") throw new Error(res.msg || `OKX error ${res.code}`);
    return res.data;
  }

  private tickerPatch(symbol: Symbol, t: OkxTicker): PricePatch {
    const patch: Partial<Ticker> = { updatedAt: Date.now() };
    const last = firstNum(t.last);
    const open = firstNum(t.open24h);
    const high = firstNum(t.high24h);
    const low = firstNum(t.low24h);
    const volCcy = firstNum(t.volCcy24h);
    const vol = firstNum(t.vol24h);
    if (Number.isFinite(last)) patch.last = last;
    if (Number.isFinite(high)) patch.high24h = high;
    if (Number.isFinite(low)) patch.low24h = low;
    if (Number.isFinite(open) && Number.isFinite(last) && open > 0) {
      patch.changePct24h = ((last - open) / open) * 100;
    }
    if (Number.isFinite(volCcy) && Number.isFinite(last)) {
      patch.volume24h = volCcy * last;
    } else if (Number.isFinite(vol) && Number.isFinite(last)) {
      patch.volume24h = vol * last;
    }
    return { [symbol]: patch } as PricePatch;
  }

  /**
   * 체결/호가 틱을 가격(last)과 진행 중인 캔들에 반영한다.
   * 200ms 스로틀을 두어 REST 호가 폴링(900ms)과 체결 스트림이
   * 화면을 과도하게 다시 그리지 않도록 한다.
   */
  private emitTick(price: number, timeMs: number, qty: number, throttled = true): void {
    if (!Number.isFinite(price) || price <= 0) return;
    const now = Date.now();
    if (throttled && now - this.lastTickAt < 200) return;
    this.lastTickAt = now;

    this.handlers.onPrices({
      [this.symbol]: { last: price, updatedAt: now },
    } as PricePatch);

    for (const candle of this.candles.push(price, timeMs, qty)) {
      this.handlers.onCandle(candle);
    }
  }

  private async refreshFunding(): Promise<void> {
    try {
      const patches: PricePatch = {};
      await Promise.all(
        SYMBOLS.map(async (symbol) => {
          const rows = await this.request<OkxFunding[]>(
            `/api/v5/public/funding-rate?instId=${instId(symbol)}`,
          );
          const row = rows[0];
          if (!row) return;
          patches[symbol] = {
            fundingRate: Number(row.fundingRate),
            nextFundingTime: Number(row.nextFundingTime),
          };
        }),
      );
      if (!this.stopped && Object.keys(patches).length > 0) this.handlers.onPrices(patches);
    } catch {
      /* 다음 주기에 재시도 */
    }
  }

  private async pollBooks(): Promise<void> {
    if (this.stopped) return;
    try {
      const books = await this.request<OkxBooks[]>(
        `/api/v5/market/books?instId=${instId(this.symbol)}&sz=10`,
      );
      if (books[0] && !this.stopped) {
        this.restBids = parseLevels(books[0].bids);
        this.restAsks = parseLevels(books[0].asks);
        this.emitBook();
        const bestBid = this.restBids[0]?.price;
        const bestAsk = this.restAsks[0]?.price;
        if (bestBid > 0 && bestAsk > 0) this.emitTick((bestBid + bestAsk) / 2, Date.now(), 0);
      }
    } catch {
      /* 폴링 실패는 무시하고 다음 주기 */
    }
  }

  private emitBook(): void {
    const book: OrderBookSnapshot = {
      bids: mergeLevels(this.wsBids, this.restBids, "bid"),
      asks: mergeLevels(this.wsAsks, this.restAsks, "ask"),
      updatedAt: Date.now(),
    };
    this.handlers.onBook(book);
  }

  private connect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (this.stopped) {
        reject(new Error("stopped"));
        return;
      }
      let settled = false;
      let socket: WebSocket;
      try {
        socket = new WebSocket(WS);
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
          reject(new Error("okx ws timeout"));
        }
      }, 5000);

      socket.onopen = () => {
        clearTimeout(timer);
        this.reconnectAttempts = 0;
        this.lastMessageAt = Date.now();
        const bar = BAR_MAP[this.interval];
        const args: { channel: string; instId: string }[] = [];
        for (const symbol of SYMBOLS) {
          args.push({ channel: "tickers", instId: instId(symbol) });
          args.push({ channel: "mark-price", instId: instId(symbol) });
        }
        args.push({ channel: "books5", instId: instId(this.symbol) });
        args.push({ channel: "trades", instId: instId(this.symbol) });
        args.push({ channel: `candle${bar}`, instId: instId(this.symbol) });
        try {
          socket.send(JSON.stringify({ op: "subscribe", args }));
        } catch {
          /* noop */
        }
        if (!settled) {
          settled = true;
          resolve();
        } else {
          this.handlers.onStatus({
            status: "live",
            source: "okx",
            note: "OKX 무기한 선물 실시간 (바이낸스 대체 피드)",
          });
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
          reject(new Error("okx ws error"));
        }
      };

      socket.onclose = () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(new Error("okx ws closed"));
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
      this.handlers.onFatal("OKX 실시간 연결 실패");
      return;
    }
    const delay = Math.min(1000 * 2 ** (this.reconnectAttempts - 1), 6000);
    this.handlers.onStatus({
      status: "reconnecting",
      source: "okx",
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

  private handleMessage(raw: unknown): void {
    if (typeof raw !== "string" || raw === "pong") return;
    let msg: { event?: string; arg?: { channel: string; instId: string }; data?: unknown[] };
    try {
      msg = JSON.parse(raw) as typeof msg;
    } catch {
      return;
    }
    if (!msg.arg || !msg.data) return;
    const symbol = symbolFromInst(msg.arg.instId);
    if (!symbol) return;
    const channel = msg.arg.channel;

    if (channel === "tickers" && msg.data[0]) {
      const row = msg.data[0] as OkxTicker;
      this.handlers.onPrices(this.tickerPatch(symbol, row));
      const last = firstNum(row.last);
      if (symbol === this.symbol && Number.isFinite(last)) this.emitTick(last, Date.now(), 0);
      return;
    }

    if (channel === "mark-price" && msg.data[0]) {
      const row = msg.data[0] as { markPx: string };
      this.handlers.onPrices({
        [symbol]: { mark: Number(row.markPx), updatedAt: Date.now() },
      } as PricePatch);
      return;
    }

    if (channel === "books5" && msg.data[0]) {
      const row = msg.data[0] as { bids: [string, string, string, string][]; asks: [string, string, string, string][] };
      this.wsBids = parseLevels(row.bids);
      this.wsAsks = parseLevels(row.asks);
      this.emitBook();
      const bestBid = this.wsBids[0]?.price;
      const bestAsk = this.wsAsks[0]?.price;
      if (symbol === this.symbol && bestBid > 0 && bestAsk > 0) {
        this.emitTick((bestBid + bestAsk) / 2, Date.now(), 0);
      }
      return;
    }

    if (channel === "trades" && msg.data[0]) {
      const row = msg.data[0] as { px: string; sz: string; side: string; ts: string; tradeId: string };
      const price = Number(row.px);
      const qty = Number(row.sz);
      const time = Number(row.ts);
      this.handlers.onPrices({ [symbol]: { last: price, updatedAt: Date.now() } } as PricePatch);
      this.handlers.onTrade({
        id: `o_${row.tradeId}`,
        price,
        qty,
        side: row.side === "sell" ? "SELL" : "BUY",
        time,
      });
      if (symbol === this.symbol) this.emitTick(price, time, qty, false);
      return;
    }

    if (channel.startsWith("candle") && msg.data[0]) {
      if (symbol !== this.symbol) return;
      const row = msg.data[0] as OkxCandleRow;
      const candle: Candle = {
        time: Math.floor(Number(row[0]) / 1000),
        open: toNum(row[1]),
        high: toNum(row[2]),
        low: toNum(row[3]),
        close: toNum(row[4]),
        volume: toNum(row[6]),
      };
      const merged = this.candles.merge(candle);
      if (merged) this.handlers.onCandle(merged);
      this.handlers.onPrices({
        [this.symbol]: { last: candle.close, updatedAt: Date.now() },
      } as PricePatch);
    }
  }
}
