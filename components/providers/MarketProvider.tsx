"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { SYMBOLS, type Interval, type Symbol } from "@/lib/constants";
import type { PricePatch } from "@/lib/market/adapter";
import { MarketFeed } from "@/lib/market/feed";
import {
  EMPTY_BOOK,
  EMPTY_TICKER,
  type Candle,
  type FeedSource,
  type FeedStatus,
  type OrderBookSnapshot,
  type PriceMap,
  type RecentTrade,
} from "@/lib/market/types";

type MarketPriceValue = {
  symbol: Symbol;
  prices: PriceMap;
  book: OrderBookSnapshot;
  trades: RecentTrade[];
  status: FeedStatus;
  source: FeedSource;
  note?: string;
  setSymbol: (symbol: Symbol) => void;
  setTimeframe: (interval: Interval) => void;
  interval: Interval;
};

type MarketChartValue = {
  symbol: Symbol;
  interval: Interval;
  candles: Candle[];
  lastCandle: Candle | null;
  ready: boolean;
};

const PriceContext = createContext<MarketPriceValue | null>(null);
const ChartContext = createContext<MarketChartValue | null>(null);

const emptyPrices: PriceMap = {
  BTCUSDT: { ...EMPTY_TICKER },
  ETHUSDT: { ...EMPTY_TICKER },
};

export function MarketProvider({ children }: { children: ReactNode }) {
  const [symbol, setSymbolState] = useState<Symbol>("BTCUSDT");
  const [interval, setIntervalState] = useState<Interval>("1m");
  const [prices, setPrices] = useState<PriceMap>(emptyPrices);
  const [book, setBook] = useState<OrderBookSnapshot>(EMPTY_BOOK);
  const [trades, setTrades] = useState<RecentTrade[]>([]);
  const [status, setStatus] = useState<{ status: FeedStatus; source: FeedSource; note?: string }>({
    status: "connecting",
    source: "binance",
    note: "실시간 시세 연결 중…",
  });
  const [candles, setCandles] = useState<Candle[]>([]);
  const [lastCandle, setLastCandle] = useState<Candle | null>(null);

  const priceBuffer = useRef<PricePatch[]>([]);
  const tradeBuffer = useRef<RecentTrade[]>([]);
  const bookRef = useRef<OrderBookSnapshot>(EMPTY_BOOK);
  const pendingCandle = useRef<Candle | null>(null);
  const lastCandleRef = useRef<Candle | null>(null);
  const candlesRef = useRef<Candle[]>([]);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedRef = useRef<MarketFeed | null>(null);

  const flush = useCallback(() => {
    flushTimer.current = null;
    if (priceBuffer.current.length > 0) {
      const patches = priceBuffer.current;
      priceBuffer.current = [];
      setPrices((prev) => {
        const next: PriceMap = { BTCUSDT: { ...prev.BTCUSDT }, ETHUSDT: { ...prev.ETHUSDT } };
        for (const patch of patches) {
          for (const key of SYMBOLS) {
            const part = patch[key];
            if (part) next[key] = { ...next[key], ...part };
          }
        }
        return next;
      });
    }
    if (tradeBuffer.current.length > 0) {
      const incoming = tradeBuffer.current;
      tradeBuffer.current = [];
      setTrades((prev) => [...incoming.slice().reverse(), ...prev].slice(0, 40));
    }
    // 실시간 캔들: 초당 여러 번 들어오는 틱을 한 번에 반영한다.
    const candle = pendingCandle.current;
    if (candle) {
      pendingCandle.current = null;
      const prev = lastCandleRef.current;
      if (!prev || candle.time >= prev.time) {
        lastCandleRef.current = candle;
        setLastCandle(candle);
        const tail = candlesRef.current[candlesRef.current.length - 1];
        if (!tail || candle.time > tail.time) {
          candlesRef.current = [...candlesRef.current, candle];
          setCandles(candlesRef.current);
        }
      }
    }
    setBook(bookRef.current);
  }, []);

  const scheduleFlush = useCallback(() => {
    if (flushTimer.current) return;
    flushTimer.current = setTimeout(flush, 140);
  }, [flush]);

  const setSymbol = useCallback((next: Symbol) => {
    setSymbolState((prev) => (prev === next ? prev : next));
  }, []);

  const setTimeframe = useCallback((next: Interval) => {
    setIntervalState((prev) => (prev === next ? prev : next));
  }, []);

  useEffect(() => {
    const feed = new MarketFeed(
      symbol,
      interval,
      {
        onPrices: (patch) => {
          priceBuffer.current.push(patch);
          if (priceBuffer.current.length > 40) priceBuffer.current.shift();
          scheduleFlush();
        },
        onBook: (snapshot) => {
          bookRef.current = snapshot;
          scheduleFlush();
        },
        onCandles: (next) => {
          candlesRef.current = next;
          const last = next.length ? next[next.length - 1] : null;
          lastCandleRef.current = last;
          pendingCandle.current = null;
          setCandles(next);
          setLastCandle(last);
        },
        onCandle: (candle) => {
          pendingCandle.current = candle;
          scheduleFlush();
        },
        onTrade: (trade) => {
          tradeBuffer.current.push(trade);
          if (tradeBuffer.current.length > 60) tradeBuffer.current.shift();
          scheduleFlush();
        },
        onFatal: () => {
          setStatus({
            status: "reconnecting",
            source: "binance",
            note: "실시간 연결이 끊겼습니다. 재연결 중…",
          });
        },
      },
      (info) => setStatus(info),
    );
    feedRef.current = feed;
    feed.start();
    return () => {
      feed.stop();
      feedRef.current = null;
      if (flushTimer.current) clearTimeout(flushTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    feedRef.current?.setMarket(symbol, interval);
    candlesRef.current = [];
    lastCandleRef.current = null;
    pendingCandle.current = null;
    priceBuffer.current = [];
    setCandles([]);
    setLastCandle(null);
    setBook(EMPTY_BOOK);
    bookRef.current = EMPTY_BOOK;
    setTrades([]);
  }, [symbol, interval]);

  const priceValue = useMemo<MarketPriceValue>(
    () => ({
      symbol,
      interval,
      prices,
      book,
      trades,
      status: status.status,
      source: status.source,
      note: status.note,
      setSymbol,
      setTimeframe,
    }),
    [symbol, interval, prices, book, trades, status, setSymbol, setTimeframe],
  );

  const chartValue = useMemo<MarketChartValue>(
    () => ({
      symbol,
      interval,
      candles,
      lastCandle,
      ready: candles.length > 0 || lastCandle !== null,
    }),
    [symbol, interval, candles, lastCandle],
  );

  return (
    <PriceContext.Provider value={priceValue}>
      <ChartContext.Provider value={chartValue}>{children}</ChartContext.Provider>
    </PriceContext.Provider>
  );
}

export function useMarketPrices(): MarketPriceValue {
  const ctx = useContext(PriceContext);
  if (!ctx) throw new Error("useMarketPrices must be used inside MarketProvider");
  return ctx;
}

export function useMarketChart(): MarketChartValue {
  const ctx = useContext(ChartContext);
  if (!ctx) throw new Error("useMarketChart must be used inside MarketProvider");
  return ctx;
}
