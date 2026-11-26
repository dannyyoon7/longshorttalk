"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import { INTERVALS, INTERVAL_LABEL, SYMBOL_META } from "@/lib/constants";
import { useAccount } from "@/lib/engine/useAccount";
import { useMarketChart, useMarketPrices } from "@/components/providers/MarketProvider";
import { cn } from "@/lib/utils";

const TradingChart = dynamic(() => import("./TradingChart"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center gap-2 text-xs text-muted">
      <Loader2 className="h-4 w-4 animate-spin" /> 차트 로딩 중…
    </div>
  ),
});

export function ChartPanel() {
  const { symbol, interval, candles, lastCandle, ready } = useMarketChart();
  const { setTimeframe, prices, status } = useMarketPrices();
  const account = useAccount();
  const positions = account.positions;
  const meta = SYMBOL_META[symbol];
  const ticker = prices[symbol];

  return (
    <section className="panel flex min-h-[420px] min-w-0 flex-col overflow-hidden lg:min-h-[500px]">
      <div className="flex items-center justify-between gap-2 border-b border-line px-2.5 py-1.5">
        <div className="flex items-center gap-1">
          {INTERVALS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTimeframe(item)}
              className={cn(
                "rounded px-2 py-1 text-[11px] font-medium transition-colors",
                interval === item
                  ? "bg-panel3 text-brand"
                  : "text-muted hover:bg-panel2 hover:text-txt",
              )}
            >
              {INTERVAL_LABEL[item]}
            </button>
          ))}
        </div>
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
      </div>

      <div className="relative flex-1">
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
          <div className="pointer-events-none absolute left-3 top-2 rounded bg-bg/70 px-1.5 py-0.5 text-[10px] text-muted backdrop-blur">
            {meta.base}USDT · {INTERVAL_LABEL[interval]} · {candles.length}봉
          </div>
        ) : null}
      </div>
    </section>
  );
}
