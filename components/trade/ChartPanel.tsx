"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import { INTERVALS, INTERVAL_LABEL, SYMBOL_META } from "@/lib/constants";
import { useAccount } from "@/lib/engine/useAccount";
import { useMarketChart, useMarketPrices } from "@/components/providers/MarketProvider";
import { cn, fmtPct, fmtPrice } from "@/lib/utils";

const TradingChart = dynamic(() => import("./TradingChart"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center gap-2 text-xs text-muted">
      <Loader2 className="h-4 w-4 animate-spin" /> 차트 로딩 중…
    </div>
  ),
});

type Props = {
  /** 모바일 거래 화면용 컴팩트 차트 (높이 260px + 실시간 가격 표시) */
  compact?: boolean;
};

export function ChartPanel({ compact = false }: Props) {
  const { symbol, interval, candles, lastCandle, ready } = useMarketChart();
  const { setTimeframe, prices, status } = useMarketPrices();
  const account = useAccount();
  const positions = account.positions;
  const meta = SYMBOL_META[symbol];
  const ticker = prices[symbol];
  const livePrice = ticker.last || ticker.mark;
  const up = ticker.changePct24h >= 0;

  return (
    <section
      className={cn(
        "panel flex min-w-0 flex-col overflow-hidden",
        compact ? "h-[260px]" : "min-h-[420px] lg:min-h-[500px]",
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-line px-2.5 py-1.5">
        <div className="flex min-w-0 items-center gap-0.5 overflow-x-auto hide-scrollbar-x">
          {INTERVALS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTimeframe(item)}
              className={cn(
                "shrink-0 rounded px-1.5 py-1 text-[11px] font-medium transition-colors sm:px-2",
                interval === item
                  ? "bg-panel3 text-brand"
                  : "text-muted hover:bg-panel2 hover:text-txt",
              )}
            >
              {INTERVAL_LABEL[item]}
            </button>
          ))}
        </div>

        {compact ? (
          <div className="flex shrink-0 items-baseline gap-1.5">
            <span className={cn("tnum text-[13px] font-bold", up ? "text-up" : "text-down")}>
              {livePrice ? fmtPrice(symbol, livePrice) : "—"}
            </span>
            <span className={cn("tnum text-[10px]", up ? "text-up" : "text-down")}>
              {ticker.last ? fmtPct(ticker.changePct24h) : ""}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-[10px] text-muted">
            <span className="hidden items-center gap-1 sm:flex">
              <i className="h-1.5 w-3 rounded-sm bg-brand" /> 진입
            </span>
            <span className="hidden items-center gap-1 sm:flex">
              <i className="h-1.5 w-3 rounded-sm bg-down" /> 청산
            </span>
            <span className="hidden items-center gap-1 md:flex">
              <i className="h-1.5 w-3 rounded-sm bg-up" /> TP
            </span>
            <span className="hidden items-center gap-1 md:flex">
              <i className="h-1.5 w-3 rounded-sm bg-[#F0B90B]" /> SL
            </span>
            <span className="tnum hidden lg:block">
              {meta.base}/USDT · {interval}
            </span>
          </div>
        )}
      </div>

      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-0">
          <TradingChart
            symbol={symbol}
            candles={candles}
            lastCandle={lastCandle}
            positions={positions}
          />
        </div>
        {!ready && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-bg/80 text-xs text-muted">
            <Loader2 className="h-5 w-5 animate-spin text-brand" />
            {status === "connecting" ? "실시간 시세 연결 중…" : "캔들 데이터를 불러오는 중…"}
          </div>
        )}
        {ready && ticker.mark ? (
          <div className="pointer-events-none absolute left-2 top-1.5 rounded bg-bg/70 px-1.5 py-0.5 text-[9px] text-muted backdrop-blur sm:text-[10px]">
            {meta.base}USDT · {INTERVAL_LABEL[interval]} · {candles.length}봉
          </div>
        ) : null}
      </div>
    </section>
  );
}
