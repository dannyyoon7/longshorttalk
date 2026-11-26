"use client";

import { useEffect, useState } from "react";
import { Activity, Clock3, Radio, TriangleAlert } from "lucide-react";
import { SYMBOLS, SYMBOL_META, type Symbol } from "@/lib/constants";
import { SOURCE_LABEL } from "@/lib/market/types";
import { useMarketPrices } from "@/components/providers/MarketProvider";
import { cn, fmtClock, fmtCompact, fmtPrice, fmtPct, fmtUsdt } from "@/lib/utils";

function FundingCountdown({ target }: { target: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const remain = target - now;
  if (!target) return <span className="text-muted">—</span>;
  return <span className="tnum">{fmtClock(remain)}</span>;
}

const STATUS_STYLE: Record<string, { dot: string; label: string; text: string }> = {
  live: { dot: "bg-up", label: "실시간", text: "text-up" },
  demo: { dot: "bg-brand", label: "데모 시세", text: "text-brand" },
  connecting: { dot: "bg-muted animate-pulse-dot", label: "연결 중", text: "text-muted" },
  reconnecting: { dot: "bg-brand animate-pulse-dot", label: "재연결 중", text: "text-brand" },
  offline: { dot: "bg-down", label: "오프라인", text: "text-down" },
};

export function MarketBar() {
  const { symbol, prices, setSymbol, status, source, note } = useMarketPrices();
  const ticker = prices[symbol];
  const meta = SYMBOL_META[symbol];
  const up = ticker.changePct24h >= 0;
  const statusStyle = STATUS_STYLE[status] ?? STATUS_STYLE.connecting;

  return (
    <section className="panel overflow-hidden">
      <div className="flex flex-col xl:flex-row">
        <div className="flex items-stretch border-b border-line xl:border-b-0 xl:border-r">
          {SYMBOLS.map((s) => {
            const m = SYMBOL_META[s];
            const t = prices[s as Symbol];
            const active = s === symbol;
            const positive = t.changePct24h >= 0;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setSymbol(s)}
                className={cn(
                  "group flex min-w-[132px] flex-1 items-center gap-2.5 px-3 py-3 text-left transition-colors xl:flex-none",
                  active ? "bg-panel2" : "hover:bg-panel2/50",
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    s === "BTCUSDT" ? "bg-[#F7931A]/15 text-[#F7931A]" : "bg-[#627EEA]/15 text-[#8FA4FF]",
                  )}
                >
                  <span className="text-[15px] font-bold leading-none">
                    {s === "BTCUSDT" ? "₿" : "Ξ"}
                  </span>
                </span>
                <span className="min-w-0">
                  <span className="flex items-baseline gap-1">
                    <span className={cn("text-[13px] font-bold", active ? "text-txt" : "text-txt/80")}>
                      {m.base}
                    </span>
                    <span className="text-[10px] text-muted">/{m.quote}</span>
                    <span className="rounded bg-panel3 px-1 text-[9px] text-muted">무기한</span>
                  </span>
                  <span className="mt-0.5 flex items-baseline gap-1.5">
                    <span className="tnum text-[12px] text-txt">
                      {t.last ? fmtPrice(s, t.last) : "—"}
                    </span>
                    <span className={cn("tnum text-[10px]", positive ? "text-up" : "text-down")}>
                      {t.last ? fmtPct(t.changePct24h) : ""}
                    </span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="grid flex-1 grid-cols-2 divide-x divide-line/60 sm:grid-cols-4">
          <div className="px-3 py-2.5">
            <p className="flex items-center gap-1 text-[10px] text-muted">
              <Activity className="h-3 w-3" /> 마크가격
            </p>
            <p className={cn("tnum mt-1 text-[17px] font-bold leading-none", up ? "text-up" : "text-down")}>
              {ticker.mark ? fmtPrice(symbol, ticker.mark) : "—"}
            </p>
            <p className="mt-1 text-[10px] text-muted">
              최근 {ticker.last ? fmtPrice(symbol, ticker.last) : "—"}
            </p>
          </div>

          <div className="px-3 py-2.5">
            <p className="text-[10px] text-muted">24시간 변동</p>
            <p className={cn("tnum mt-1 text-[15px] font-semibold leading-none", up ? "text-up" : "text-down")}>
              {ticker.last ? fmtPct(ticker.changePct24h) : "—"}
            </p>
            <p className="tnum mt-1 truncate text-[10px] text-muted">
              고 {ticker.high24h ? fmtPrice(symbol, ticker.high24h) : "—"} · 저{" "}
              {ticker.low24h ? fmtPrice(symbol, ticker.low24h) : "—"}
            </p>
          </div>

          <div className="hidden px-3 py-2.5 sm:block">
            <p className="text-[10px] text-muted">24시간 거래대금</p>
            <p className="tnum mt-1 text-[15px] font-semibold leading-none text-txt">
              {ticker.volume24h ? `${fmtCompact(ticker.volume24h)}` : "—"}
              <span className="ml-1 text-[10px] font-normal text-muted">USDT</span>
            </p>
            <p className="mt-1 flex items-center gap-1 text-[10px] text-muted">
              <Clock3 className="h-3 w-3" /> 펀딩{" "}
              <span className={cn("tnum", ticker.fundingRate >= 0 ? "text-up" : "text-down")}>
                {ticker.updatedAt ? `${(ticker.fundingRate * 100).toFixed(4)}%` : "—"}
              </span>
            </p>
          </div>

          <div className="hidden px-3 py-2.5 sm:block">
            <p className="text-[10px] text-muted">다음 펀딩까지</p>
            <p className="mt-1 text-[15px] font-semibold leading-none text-txt">
              <FundingCountdown target={ticker.nextFundingTime} />
            </p>
            <p className="mt-1 truncate text-[10px] text-muted">
              최대 {meta.maxLeverage}x · 유지증거금 0.4%
            </p>
          </div>
        </div>

        <div
          data-testid="feed-status"
          className="flex items-center justify-between gap-3 border-t border-line px-3 py-2 xl:w-[172px] xl:flex-col xl:items-start xl:justify-center xl:border-l xl:border-t-0"
        >
          <div className="flex items-center gap-1.5">
            <span className={cn("h-1.5 w-1.5 rounded-full", statusStyle.dot)} />
            <span className={cn("text-[11px] font-semibold", statusStyle.text)}>{statusStyle.label}</span>
            <Radio className="h-3 w-3 text-muted" />
          </div>
          <div className="text-right sm:hidden">
            <p className="text-[10px] text-muted">
              펀딩 <FundingCountdown target={ticker.nextFundingTime} /> ·{" "}
              <span className={cn(ticker.fundingRate >= 0 ? "text-up" : "text-down")}>
                {ticker.updatedAt ? `${(ticker.fundingRate * 100).toFixed(4)}%` : "—"}
              </span>
            </p>
          </div>
          <div className="text-right xl:text-left">
            <p className="text-[10px] font-medium text-muted">{SOURCE_LABEL[source]}</p>
            <p className="max-w-[190px] truncate text-[9px] text-muted/70" title={note}>
              {note ?? "실시간 스트림"}
            </p>
          </div>
        </div>
      </div>

      {(status === "demo" || status === "offline" || status === "reconnecting" || (note?.includes("폴링") ?? false)) && note && (
        <div className="flex items-center gap-1.5 border-t border-brand/20 bg-brand/[0.06] px-3 py-1.5 text-[11px] text-brand">
          <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{note}</span>
          <span className="ml-auto hidden shrink-0 text-[10px] text-brand/70 sm:block">
            BTC {fmtUsdt(prices.BTCUSDT.last, 0)} · ETH {fmtUsdt(prices.ETHUSDT.last, 0)} USDT
          </span>
        </div>
      )}
    </section>
  );
}
