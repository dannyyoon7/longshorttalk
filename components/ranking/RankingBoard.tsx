"use client";

import { useEffect, useMemo, useState } from "react";
import { Crown, Medal, TrendingDown, TrendingUp } from "lucide-react";
import { SYMBOL_META } from "@/lib/constants";
import { equityOf } from "@/lib/engine/store";
import { useAccount } from "@/lib/engine/useAccount";
import { DEMO_TRADERS, LEADERBOARD_NOTE, type RankedTrader } from "@/lib/local/ranking";
import { profileStore, useProfile } from "@/lib/profile";
import { useMarketPrices } from "@/components/providers/MarketProvider";
import { cn, fmtPct, fmtUsdt } from "@/lib/utils";

type Period = "weekly" | "allTime";

type Row = RankedTrader & { me?: boolean };

export function RankingBoard() {
  const account = useAccount();
  const { prices } = useMarketPrices();
  const profile = useProfile();
  const [period, setPeriod] = useState<Period>("weekly");

  useEffect(() => {
    profileStore.hydrate();
  }, []);

  const myRow = useMemo<Row>(() => {
    const equity = equityOf(account, prices);
    const roi = account.deposits > 0 ? ((equity - account.deposits) / account.deposits) * 100 : 0;
    const closed = account.trades.filter((t) => t.action !== "OPEN" && t.action !== "FUNDING");
    const wins = closed.filter((t) => t.pnl > 0).length;
    const winRate = closed.length ? Math.round((wins / closed.length) * 100) : 0;
    const mainPosition = account.positions[0];
    return {
      id: "me",
      nickname: profile.nickname,
      emoji: profile.emoji,
      weekly: Number(roi.toFixed(2)),
      allTime: Number(roi.toFixed(2)),
      winRate,
      trades: closed.length,
      favorite: mainPosition?.symbol === "ETHUSDT" ? "ETH" : "BTC",
      leverage: mainPosition?.leverage ?? 10,
      tagline: `모의 자산 ${fmtUsdt(equity)} USDT`,
      me: true,
    };
  }, [account, prices, profile]);

  const rows = useMemo<Row[]>(() => {
    const list: Row[] = [...DEMO_TRADERS.map((t) => ({ ...t })), myRow];
    return list.sort((a, b) => b[period] - a[period]);
  }, [period, myRow]);

  const maxRoi = Math.max(...rows.map((r) => Math.abs(r[period])), 1);
  const podium = rows.slice(0, 3);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex rounded-md border border-line bg-panel p-0.5">
          {(
            [
              { key: "weekly", label: "주간 수익률" },
              { key: "allTime", label: "전체 수익률" },
            ] as { key: Period; label: string }[]
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setPeriod(tab.key)}
              className={cn(
                "rounded px-3 py-1.5 text-[11px] font-medium transition-colors",
                period === tab.key ? "bg-panel3 text-txt" : "text-muted hover:text-txt",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <span className="text-[10px] text-muted">참가자 {rows.length}명 · 모의투자</span>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {podium.map((trader, index) => {
          const styles = [
            "border-brand/40 bg-gradient-to-b from-brand/10 to-panel",
            "border-line bg-gradient-to-b from-panel3/60 to-panel",
            "border-[#B06B3B]/30 bg-gradient-to-b from-[#B06B3B]/10 to-panel",
          ];
          return (
            <div
              key={trader.id}
              className={cn(
                "relative overflow-hidden rounded-lg border p-3.5",
                styles[index],
                trader.me && "ring-1 ring-brand/50",
              )}
            >
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-bg/50 text-[11px] font-bold text-brand">
                  {index === 0 ? <Crown className="h-3.5 w-3.5" /> : index === 1 ? <Medal className="h-3.5 w-3.5" /> : <Medal className="h-3.5 w-3.5" />}
                </span>
                <span className="text-[20px] leading-none">{trader.emoji}</span>
                <div className="min-w-0">
                  <p className="flex items-center gap-1 text-[12px] font-semibold text-txt">
                    <span className="truncate">{trader.nickname}</span>
                    {trader.me && <span className="rounded bg-brand px-1 text-[8px] text-bg">나</span>}
                  </p>
                  <p className="truncate text-[9px] text-muted">{trader.tagline}</p>
                </div>
              </div>
              <p
                className={cn(
                  "tnum mt-3 text-[22px] font-bold leading-none",
                  trader[period] >= 0 ? "text-up" : "text-down",
                )}
              >
                {fmtPct(trader[period])}
              </p>
              <p className="mt-1 text-[9px] text-muted">
                승률 {trader.winRate}% · {trader.trades}회 · {trader.favorite} {trader.leverage}x
              </p>
            </div>
          );
        })}
      </div>

      <section className="overflow-hidden rounded-lg border border-line bg-panel">
        <div className="hidden grid-cols-[48px_minmax(0,1fr)_90px_70px_60px_90px] gap-2 border-b border-line px-3 py-2 text-[9px] uppercase tracking-wide text-muted sm:grid">
          <span>순위</span>
          <span>트레이더</span>
          <span className="text-right">수익률</span>
          <span className="text-right">승률</span>
          <span className="text-right">거래</span>
          <span className="text-right">주력</span>
        </div>
        {rows.map((trader, index) => {
          const value = trader[period];
          const width = Math.min((Math.abs(value) / maxRoi) * 100, 100);
          return (
            <div
              key={trader.id}
              className={cn(
                "relative grid grid-cols-[32px_minmax(0,1fr)_80px] items-center gap-2 px-3 py-2.5 sm:grid-cols-[48px_minmax(0,1fr)_90px_70px_60px_90px]",
                trader.me ? "bg-brand/[0.06]" : "odd:bg-panel2/20",
              )}
            >
              <span
                className="absolute inset-y-0 left-0 -z-0 opacity-[0.12]"
                style={{
                  width: `${width}%`,
                  background: value >= 0 ? "linear-gradient(90deg,#0ECB81,transparent)" : "linear-gradient(90deg,#F6465D,transparent)",
                }}
              />
              <span
                className={cn(
                  "tnum relative z-10 text-[11px] font-semibold",
                  index === 0 ? "text-brand" : "text-muted",
                )}
              >
                {index + 1}
              </span>
              <div className="relative z-10 flex min-w-0 items-center gap-1.5">
                <span className="text-[14px]">{trader.emoji}</span>
                <div className="min-w-0">
                  <p className="flex items-center gap-1 text-[11.5px] font-medium text-txt">
                    <span className="truncate">{trader.nickname}</span>
                    {trader.me && <span className="rounded bg-brand px-1 text-[8px] text-bg">나</span>}
                  </p>
                  <p className="truncate text-[9px] text-muted">{trader.tagline}</p>
                </div>
              </div>
              <span
                className={cn(
                  "tnum relative z-10 flex items-center justify-end gap-0.5 text-[11px] font-semibold",
                  value >= 0 ? "text-up" : "text-down",
                )}
              >
                {value >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {fmtPct(value)}
              </span>
              <span className="tnum relative z-10 hidden text-right text-[10px] text-txt/80 sm:block">
                {trader.winRate}%
              </span>
              <span className="tnum relative z-10 hidden text-right text-[10px] text-muted sm:block">
                {trader.trades}
              </span>
              <span className="relative z-10 hidden text-right text-[10px] text-muted sm:block">
                {trader.favorite} {trader.leverage}x
              </span>
            </div>
          );
        })}
      </section>

      <p className="text-[10px] leading-relaxed text-muted/70">{LEADERBOARD_NOTE}</p>
      <p className="text-[10px] leading-relaxed text-muted/60">
        내 수익률은 현재 브라우저의 모의 계좌 기준입니다. 계좌를 초기화하면 기록도 함께 초기화됩니다.
        주력 코인은 현재 보유 포지션 기준입니다.
      </p>
      <p className="text-[10px] text-muted/60">
        {SYMBOL_META.BTCUSDT.base}·{SYMBOL_META.ETHUSDT.base} 선물 모의투자 기록만 집계합니다.
      </p>
    </div>
  );
}
