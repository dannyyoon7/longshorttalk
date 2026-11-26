"use client";

import { ChevronRight, ListOrdered } from "lucide-react";
import { SYMBOL_META } from "@/lib/constants";
import { useMarketPrices } from "@/components/providers/MarketProvider";
import { cn, fmtPrice, fmtQty } from "@/lib/utils";

type Props = {
  onPriceSelect: (price: number) => void;
  onOpenBook: () => void;
};

const ROWS = 3;

/**
 * 모바일 거래 화면용 호가 요약.
 * 차트 바로 아래에 붙어 스프레드와 상위 호가를 보여주고,
 * 호가를 누르면 지정가 가격이 입력된다. 전체 호가는 탭에서 연다.
 */
export function CompactBook({ onPriceSelect, onOpenBook }: Props) {
  const { symbol, book, prices } = useMarketPrices();
  const meta = SYMBOL_META[symbol];
  const ticker = prices[symbol];

  const asks = [...book.asks].sort((a, b) => b.price - a.price).slice(-ROWS); // 높은 가격이 위
  const bids = [...book.bids].sort((a, b) => b.price - a.price).slice(0, ROWS);
  const bestAsk = book.asks.length ? Math.min(...book.asks.map((l) => l.price)) : 0;
  const bestBid = book.bids.length ? Math.max(...book.bids.map((l) => l.price)) : 0;
  const mid = (bestAsk + bestBid) / 2;
  const spread = bestAsk && bestBid ? bestAsk - bestBid : 0;
  const spreadPct = mid > 0 ? (spread / mid) * 100 : 0;
  const up = ticker.changePct24h >= 0;

  return (
    <section className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-2.5 py-1">
        <span className="flex items-center gap-1 text-[10px] font-semibold text-txt">
          <ListOrdered className="h-3 w-3 text-brand" /> 호가
          <span className="font-normal text-muted">({meta.base})</span>
        </span>
        <span className="tnum text-[9px] text-muted">
          스프레드 {spread ? fmtPrice(symbol, spread) : "—"} ({spreadPct.toFixed(3)}%)
        </span>
      </div>

      <div className="flex flex-col">
        {asks.length === 0 && (
          <div className="px-2 py-1.5 text-center text-[10px] text-muted">호가 수신 중…</div>
        )}
        {asks.map((level) => (
          <button
            key={`a-${level.price}`}
            type="button"
            onClick={() => onPriceSelect(level.price)}
            className="flex items-center justify-between px-2.5 py-[1px] text-[10.5px] leading-4 hover:bg-panel3/60"
          >
            <span className="tnum font-medium text-down">{fmtPrice(symbol, level.price)}</span>
            <span className="tnum text-txt/80">{fmtQty(level.qty, 3)}</span>
          </button>
        ))}

        <div className="my-[2px] flex items-center justify-between border-y border-line/70 bg-panel2/60 px-2.5 py-1">
          <span className={cn("tnum text-[12px] font-bold", up ? "text-up" : "text-down")}>
            {ticker.last ? fmtPrice(symbol, ticker.last) : "—"}
          </span>
          <span className="text-[9px] text-muted">현재가 · 호가 클릭 = 지정가 입력</span>
        </div>

        {bids.map((level) => (
          <button
            key={`b-${level.price}`}
            type="button"
            onClick={() => onPriceSelect(level.price)}
            className="flex items-center justify-between px-2.5 py-[1px] text-[10.5px] leading-4 hover:bg-panel3/60"
          >
            <span className="tnum font-medium text-up">{fmtPrice(symbol, level.price)}</span>
            <span className="tnum text-txt/80">{fmtQty(level.qty, 3)}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onOpenBook}
        className="flex w-full items-center justify-center gap-0.5 border-t border-line py-1.5 text-[10px] font-medium text-muted hover:text-txt"
      >
        호가·체결 전체 보기 <ChevronRight className="h-3 w-3" />
      </button>
    </section>
  );
}
