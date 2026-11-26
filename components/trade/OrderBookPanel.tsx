"use client";

import { useMemo, useState } from "react";
import { ArrowDownUp, ListOrdered } from "lucide-react";
import { SYMBOL_META } from "@/lib/constants";
import { useMarketPrices } from "@/components/providers/MarketProvider";
import type { OrderBookLevel } from "@/lib/market/types";
import { cn, fmtPrice, fmtQty, fmtTimeHM } from "@/lib/utils";

type Props = {
  onPriceSelect: (price: number) => void;
};

function DepthRow({
  level,
  cumulative,
  max,
  side,
  symbol,
  onClick,
}: {
  level: OrderBookLevel;
  cumulative: number;
  max: number;
  side: "ask" | "bid";
  symbol: keyof typeof SYMBOL_META;
  onClick: () => void;
}) {
  const width = max > 0 ? Math.min((cumulative / max) * 100, 100) : 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex w-full items-center justify-between px-2 py-[3px] text-[11px] leading-4 transition-colors hover:bg-panel3/60"
      title="클릭하면 지정가 주문 가격으로 입력됩니다"
    >
      <span
        className={cn(
          "absolute inset-y-0 right-0 transition-[width] duration-150",
          side === "ask" ? "bg-down/[0.09]" : "bg-up/[0.09]",
        )}
        style={{ width: `${width}%` }}
      />
      <span className={cn("tnum relative z-10 font-medium", side === "ask" ? "text-down" : "text-up")}>
        {fmtPrice(symbol, level.price)}
      </span>
      <span className="tnum relative z-10 text-txt/85">{fmtQty(level.qty, 3)}</span>
    </button>
  );
}

export function OrderBookPanel({ onPriceSelect }: Props) {
  const { symbol, book, trades, prices } = useMarketPrices();
  const [tab, setTab] = useState<"book" | "trades">("book");
  const meta = SYMBOL_META[symbol];
  const ticker = prices[symbol];

  const { asks, bids, maxCum, spread, spreadPct } = useMemo(() => {
    const asksSorted = [...book.asks].sort((a, b) => b.price - a.price);
    const bidsSorted = [...book.bids].sort((a, b) => b.price - a.price);
    let askCum = 0;
    let bidCum = 0;
    const askCums = asksSorted.map((l) => (askCum += l.qty));
    const bidCums = bidsSorted.map((l) => (bidCum += l.qty));
    const bestAsk = book.asks.length ? Math.min(...book.asks.map((l) => l.price)) : 0;
    const bestBid = book.bids.length ? Math.max(...book.bids.map((l) => l.price)) : 0;
    const mid = (bestAsk + bestBid) / 2;
    return {
      asks: asksSorted.map((level, i) => ({ level, cumulative: askCums[i] })),
      bids: bidsSorted.map((level, i) => ({ level, cumulative: bidCums[i] })),
      maxCum: Math.max(askCum, bidCum, 1),
      spread: bestAsk && bestBid ? bestAsk - bestBid : 0,
      spreadPct: mid > 0 ? ((bestAsk - bestBid) / mid) * 100 : 0,
    };
  }, [book]);

  return (
    <section className="panel flex min-h-[420px] flex-col overflow-hidden lg:min-h-[500px]">
      <div className="flex items-center justify-between border-b border-line px-2.5 py-1.5">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setTab("book")}
            className={cn(
              "flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium",
              tab === "book" ? "bg-panel3 text-txt" : "text-muted hover:text-txt",
            )}
          >
            <ListOrdered className="h-3 w-3" /> 호가
          </button>
          <button
            type="button"
            onClick={() => setTab("trades")}
            className={cn(
              "flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium",
              tab === "trades" ? "bg-panel3 text-txt" : "text-muted hover:text-txt",
            )}
          >
            <ArrowDownUp className="h-3 w-3" /> 체결
          </button>
        </div>
        <span className="text-[10px] text-muted">{meta.base}</span>
      </div>

      {tab === "book" ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center justify-between px-2 pb-1 pt-1.5 text-[9px] text-muted">
            <span>가격(USDT)</span>
            <span>수량({meta.base})</span>
          </div>

          <div className="flex flex-col">
            {asks.length === 0 && (
              <div className="flex h-[180px] items-center justify-center text-[11px] text-muted">
                호가 수신 중…
              </div>
            )}
            {asks.map(({ level, cumulative }) => (
              <DepthRow
                key={`ask-${level.price}`}
                level={level}
                cumulative={cumulative}
                max={maxCum}
                side="ask"
                symbol={symbol}
                onClick={() => onPriceSelect(level.price)}
              />
            ))}
          </div>

          <div className="my-1 flex items-center justify-between border-y border-line/70 bg-panel2/60 px-2 py-1">
            <span className={cn("tnum text-[13px] font-bold", ticker.changePct24h >= 0 ? "text-up" : "text-down")}>
              {ticker.last ? fmtPrice(symbol, ticker.last) : "—"}
            </span>
            <span className="tnum text-[9px] text-muted">
              스프레드 {spread ? fmtPrice(symbol, spread) : "—"} ({spreadPct.toFixed(3)}%)
            </span>
          </div>

          <div className="flex flex-col">
            {bids.map(({ level, cumulative }) => (
              <DepthRow
                key={`bid-${level.price}`}
                level={level}
                cumulative={cumulative}
                max={maxCum}
                side="bid"
                symbol={symbol}
                onClick={() => onPriceSelect(level.price)}
              />
            ))}
            {bids.length === 0 && <div className="h-[180px]" />}
          </div>

          <p className="mt-auto px-2 py-1.5 text-[9px] leading-relaxed text-muted/70">
            호가를 클릭하면 지정가 주문 가격이 자동 입력됩니다.
          </p>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center justify-between px-2 py-1.5 text-[9px] text-muted">
            <span>시간</span>
            <span className="flex gap-6">
              <span>가격</span>
              <span>수량</span>
            </span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {trades.length === 0 && (
              <div className="flex h-[200px] items-center justify-center text-[11px] text-muted">
                체결 데이터 수신 중…
              </div>
            )}
            {trades.map((trade) => (
              <div
                key={trade.id + trade.time}
                className="flex items-center justify-between px-2 py-[3px] text-[11px]"
              >
                <span className="tnum text-muted">{fmtTimeHM(trade.time)}</span>
                <span className="flex items-center gap-4">
                  <span className={cn("tnum", trade.side === "BUY" ? "text-up" : "text-down")}>
                    {fmtPrice(symbol, trade.price)}
                  </span>
                  <span className="tnum w-14 text-right text-txt/80">{fmtQty(trade.qty, 3)}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
