"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, RefreshCw, RotateCcw, Share2, Trash2, Wallet } from "lucide-react";
import { REFILL_THRESHOLD, STORAGE_KEYS, SYMBOL_META } from "@/lib/constants";
import { liquidationDistancePercent, roePercent, unrealizedPnl } from "@/lib/engine/calc";
import { accountStore, availableOf, equityOf, totalUnrealized } from "@/lib/engine/store";
import type { TradeAction } from "@/lib/engine/types";
import { useAccount } from "@/lib/engine/useAccount";
import { useProfile } from "@/lib/profile";
import { useToast } from "@/components/providers/ToastProvider";
import { useMarketPrices } from "@/components/providers/MarketProvider";
import { cn, fmtDateTime, fmtPct, fmtPrice, fmtQty, fmtSigned, fmtUsdt } from "@/lib/utils";

const ACTION_LABEL: Record<TradeAction, string> = {
  OPEN: "진입",
  CLOSE: "종료",
  TP: "익절",
  SL: "손절",
  LIQUIDATION: "강제청산",
  FUNDING: "펀딩",
};

const ACTION_STYLE: Record<TradeAction, string> = {
  OPEN: "text-brand bg-brand/10",
  CLOSE: "text-muted bg-panel3",
  TP: "text-up bg-up/10",
  SL: "text-down bg-down/10",
  LIQUIDATION: "text-down bg-down/15",
  FUNDING: "text-[#B48CF2] bg-[#B48CF2]/10",
};

type Tab = "positions" | "orders" | "history" | "assets";

export function PositionsPanel() {
  const account = useAccount();
  const { prices } = useMarketPrices();
  const { push } = useToast();
  const profile = useProfile();
  const [tab, setTab] = useState<Tab>("positions");

  const unrealized = totalUnrealized(account, prices);
  const equity = equityOf(account, prices);
  const available = availableOf(account, prices);
  const marginUsed = account.positions.reduce((sum, p) => sum + p.margin, 0);
  const orderMargin = account.orders.reduce((sum, o) => sum + o.margin, 0);
  const roi = account.deposits > 0 ? ((equity - account.deposits) / account.deposits) * 100 : 0;

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "positions", label: "포지션", count: account.positions.length },
    { key: "orders", label: "미체결", count: account.orders.length },
    { key: "history", label: "거래내역", count: account.trades.length },
    { key: "assets", label: "자산" },
  ];

  function sharePosition(positionId: string) {
    const position = account.positions.find((p) => p.id === positionId);
    if (!position) return;
    const mark = prices[position.symbol].mark || prices[position.symbol].last;
    const pnl = unrealizedPnl(position, mark);
    const roe = roePercent(pnl, position.margin);
    const base = SYMBOL_META[position.symbol].base;
    try {
      window.localStorage.setItem(
        STORAGE_KEYS.shareDraft,
        JSON.stringify({
          symbol: position.symbol,
          badge: `${base} ${position.leverage}x ${position.side === "LONG" ? "롱" : "숏"} ${fmtPct(roe)}`,
          pnlPct: Number(roe.toFixed(2)),
          title: `${base} ${position.leverage}x ${position.side === "LONG" ? "롱" : "숏"} ${fmtPct(roe)} 인증`,
          body: `진입가 ${fmtPrice(position.symbol, position.entryPrice)} · 현재 ${fmtPrice(position.symbol, mark)} · ${position.marginMode === "CROSS" ? "교차" : "격리"} ${position.leverage}x\n포지션 인증합니다. 리스크는 각자 관리하세요!`,
        }),
      );
    } catch {
      /* noop */
    }
    window.location.href = "/community#write";
  }

  return (
    <section className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-2.5">
        <div className="flex items-center gap-0.5 overflow-x-auto hide-scrollbar-x">
          {tabs.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={cn(
                "relative flex shrink-0 items-center gap-1 px-2.5 py-2.5 text-[12px] font-medium transition-colors",
                tab === item.key ? "text-txt" : "text-muted hover:text-txt",
              )}
            >
              {item.label}
              {item.count !== undefined && item.count > 0 && (
                <span className="tnum rounded bg-panel3 px-1 text-[9px] text-muted">{item.count}</span>
              )}
              {tab === item.key && <span className="absolute inset-x-1.5 -bottom-px h-0.5 rounded-full bg-brand" />}
            </button>
          ))}
        </div>
        <div className="hidden items-center gap-2 text-[10px] text-muted sm:flex">
          <Wallet className="h-3 w-3" />
          <span className="tnum">주문가능 {fmtUsdt(available)} USDT</span>
        </div>
      </div>

      <div className="max-h-[340px] overflow-y-auto p-2.5">
        {tab === "positions" &&
          (account.positions.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-1.5 py-10 text-center">
              <p className="text-[12px] text-muted">보유 포지션이 없습니다.</p>
              <p className="text-[11px] text-muted/70">
                주문 패널에서 롱/숏을 눌러 첫 모의 포지션을 열어보세요.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {account.positions.map((position) => {
                const meta = SYMBOL_META[position.symbol];
                const mark = prices[position.symbol].mark || prices[position.symbol].last;
                const pnl = unrealizedPnl(position, mark);
                const roe = roePercent(pnl, position.margin);
                const up = pnl >= 0;
                const liqDistance = liquidationDistancePercent(position.entryPrice, position.liquidationPrice);
                const danger = mark > 0 && position.liquidationPrice > 0 && liqDistance < 3;
                return (
                  <div
                    key={position.id}
                    className={cn(
                      "rounded-lg border bg-panel2/60 p-2.5",
                      danger ? "border-down/50" : "border-line/80",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[10px] font-bold",
                            position.side === "LONG" ? "bg-up/15 text-up" : "bg-down/15 text-down",
                          )}
                        >
                          {position.side === "LONG" ? "롱" : "숏"} {position.leverage}x
                        </span>
                        <span className="text-[12px] font-semibold text-txt">
                          {meta.base}
                          <span className="text-[10px] font-normal text-muted">/{meta.quote}</span>
                        </span>
                        <span className="rounded border border-line px-1 text-[9px] text-muted">
                          {position.marginMode === "CROSS" ? "교차" : "격리"}
                        </span>
                        {danger && (
                          <span className="animate-pulse-dot rounded bg-down/20 px-1 text-[9px] font-semibold text-down">
                            청산 임박
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <p className={cn("tnum text-[14px] font-bold leading-none", up ? "text-up" : "text-down")}>
                          {fmtSigned(pnl)} <span className="text-[9px] font-normal text-muted">USDT</span>
                        </p>
                        <p className={cn("tnum mt-1 text-[11px]", up ? "text-up" : "text-down")}>
                          {fmtPct(roe)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] sm:grid-cols-4">
                      <div className="flex justify-between sm:block">
                        <span className="text-muted">수량</span>
                        <p className="tnum text-txt sm:mt-0.5">
                          {fmtQty(position.qty)} {meta.base}
                        </p>
                      </div>
                      <div className="flex justify-between sm:block">
                        <span className="text-muted">진입가</span>
                        <p className="tnum text-txt sm:mt-0.5">{fmtPrice(position.symbol, position.entryPrice)}</p>
                      </div>
                      <div className="flex justify-between sm:block">
                        <span className="text-muted">마크가</span>
                        <p className="tnum text-txt sm:mt-0.5">{fmtPrice(position.symbol, mark)}</p>
                      </div>
                      <div className="flex justify-between sm:block">
                        <span className="text-muted">청산가</span>
                        <p
                          className={cn("tnum sm:mt-0.5", danger ? "text-down" : "text-txt/90")}
                          title={
                            position.liquidationPrice
                              ? "유지증거금률 0.4% 기준 추정 청산가"
                              : "교차 모드에서 지갑 잔고가 충분해 청산가가 형성되지 않습니다."
                          }
                        >
                          {position.liquidationPrice ? fmtPrice(position.symbol, position.liquidationPrice) : "없음"}
                        </p>
                      </div>
                      <div className="flex justify-between sm:block">
                        <span className="text-muted">증거금</span>
                        <p className="tnum text-txt sm:mt-0.5">{fmtUsdt(position.margin)}</p>
                      </div>
                      <div className="flex justify-between sm:block">
                        <span className="text-muted">TP / SL</span>
                        <p className="tnum sm:mt-0.5">
                          <span className="text-up">{position.tp ? fmtPrice(position.symbol, position.tp) : "—"}</span>
                          <span className="mx-1 text-muted">/</span>
                          <span className="text-[#F0B90B]">
                            {position.sl ? fmtPrice(position.symbol, position.sl) : "—"}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="mt-2 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => accountStore.closePosition(position.id, 50, prices)}
                        className="rounded border border-line px-2 py-1 text-[10px] text-muted transition-colors hover:border-txt/30 hover:text-txt"
                      >
                        50% 종료
                      </button>
                      <button
                        type="button"
                        onClick={() => accountStore.closePosition(position.id, 100, prices)}
                        className="rounded border border-line px-2 py-1 text-[10px] text-txt transition-colors hover:border-down/50 hover:text-down"
                      >
                        전체 종료
                      </button>
                      <button
                        type="button"
                        onClick={() => sharePosition(position.id)}
                        className="ml-auto flex items-center gap-1 rounded border border-line px-2 py-1 text-[10px] text-muted transition-colors hover:text-brand"
                      >
                        <Share2 className="h-2.5 w-2.5" /> 인증글
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

        {tab === "orders" &&
          (account.orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-1 py-10 text-center">
              <p className="text-[12px] text-muted">미체결 지정가 주문이 없습니다.</p>
              <p className="text-[11px] text-muted/70">
                호가를 클릭하거나 지정가 주문을 걸면 현재가 도달 시 자동 체결됩니다.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {account.orders.map((order) => {
                const meta = SYMBOL_META[order.symbol];
                const mark = prices[order.symbol].mark || prices[order.symbol].last;
                const distance = mark ? ((order.price - mark) / mark) * 100 : 0;
                return (
                  <div
                    key={order.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-line/80 bg-panel2/60 px-2.5 py-2"
                  >
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-bold",
                        order.side === "LONG" ? "bg-up/15 text-up" : "bg-down/15 text-down",
                      )}
                    >
                      {order.side === "LONG" ? "롱" : "숏"} {order.leverage}x
                    </span>
                    <span className="text-[11px] text-txt">
                      {meta.base} 지정가 {fmtPrice(order.symbol, order.price)}
                    </span>
                    <span className="tnum text-[10px] text-muted">
                      수량 {fmtQty(order.qty)} · 증거금 {fmtUsdt(order.margin)}
                    </span>
                    <span className="tnum text-[10px] text-muted">
                      현재가 대비 {fmtPct(distance)}
                    </span>
                    <span className="tnum ml-auto text-[10px] text-muted">
                      {fmtDateTime(order.createdAt)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        accountStore.cancelOrder(order.id);
                        push("주문이 취소되었습니다.", "info");
                      }}
                      className="flex items-center gap-1 rounded border border-line px-1.5 py-0.5 text-[10px] text-muted hover:text-down"
                    >
                      <Trash2 className="h-2.5 w-2.5" /> 취소
                    </button>
                  </div>
                );
              })}
            </div>
          ))}

        {tab === "history" &&
          (account.trades.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-1 py-10 text-center">
              <p className="text-[12px] text-muted">거래 내역이 없습니다.</p>
              <p className="text-[11px] text-muted/70">첫 주문을 체결하면 여기에 기록됩니다.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left">
                <thead>
                  <tr className="text-[9px] uppercase tracking-wide text-muted">
                    <th className="px-1 pb-1.5 font-medium">시간</th>
                    <th className="px-1 pb-1.5 font-medium">구분</th>
                    <th className="px-1 pb-1.5 text-right font-medium">가격</th>
                    <th className="px-1 pb-1.5 text-right font-medium">수량</th>
                    <th className="px-1 pb-1.5 text-right font-medium">수수료</th>
                    <th className="px-1 pb-1.5 text-right font-medium">손익</th>
                    <th className="px-1 pb-1.5 text-right font-medium">ROE</th>
                  </tr>
                </thead>
                <tbody>
                  {account.trades.map((trade) => (
                    <tr key={trade.id} className="border-t border-line/50 text-[10px]">
                      <td className="tnum whitespace-nowrap px-1 py-1.5 text-muted">
                        {fmtDateTime(trade.createdAt)}
                      </td>
                      <td className="px-1 py-1.5">
                        <span className={cn("rounded px-1 py-0.5 text-[9px]", ACTION_STYLE[trade.action])}>
                          {ACTION_LABEL[trade.action]}
                        </span>
                        <span className="ml-1 text-muted">{SYMBOL_META[trade.symbol].base}</span>
                      </td>
                      <td className="tnum px-1 py-1.5 text-right text-txt/90">{fmtPrice(trade.symbol, trade.price)}</td>
                      <td className="tnum px-1 py-1.5 text-right text-txt/90">{fmtQty(trade.qty)}</td>
                      <td className="tnum px-1 py-1.5 text-right text-muted">{fmtUsdt(trade.fee, 2)}</td>
                      <td
                        className={cn(
                          "tnum px-1 py-1.5 text-right",
                          trade.pnl > 0 ? "text-up" : trade.pnl < 0 ? "text-down" : "text-muted",
                        )}
                      >
                        {trade.action === "OPEN" ? "—" : fmtSigned(trade.pnl)}
                      </td>
                      <td
                        className={cn(
                          "tnum px-1 py-1.5 text-right",
                          trade.roe > 0 ? "text-up" : trade.roe < 0 ? "text-down" : "text-muted",
                        )}
                      >
                        {trade.action === "OPEN" ? "—" : fmtPct(trade.roe)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

        {tab === "assets" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[
                { label: "총 자산 (Equity)", value: fmtUsdt(equity), strong: true },
                {
                  label: "미실현 손익",
                  value: `${fmtSigned(unrealized)} USDT`,
                  color: unrealized >= 0 ? "text-up" : "text-down",
                },
                { label: "지갑 잔고", value: `${fmtUsdt(account.walletBalance)} USDT` },
                { label: "사용 증거금", value: `${fmtUsdt(marginUsed)} USDT` },
                { label: "주문 예약", value: `${fmtUsdt(orderMargin)} USDT` },
                { label: "주문 가능", value: `${fmtUsdt(available)} USDT`, color: "text-brand" },
              ].map((item) => (
                <div key={item.label} className="rounded-md border border-line/70 bg-panel2/50 px-2.5 py-2">
                  <p className="text-[9px] text-muted">{item.label}</p>
                  <p
                    className={cn(
                      "tnum mt-1 text-[12px] font-semibold",
                      item.color ?? "text-txt",
                      item.strong && "text-[14px]",
                    )}
                  >
                    {item.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 rounded-md border border-line/70 bg-panel2/40 px-2.5 py-2 text-[10px]">
              <span className="text-muted">누적 입금</span>
              <span className="tnum text-txt">{fmtUsdd(account.deposits)} USDT</span>
              <span className="text-muted">·</span>
              <span className="text-muted">수익률</span>
              <span className={cn("tnum", roi >= 0 ? "text-up" : "text-down")}>{fmtPct(roi)}</span>
              <span className="text-muted">·</span>
              <span className="text-muted">시드 리필 {account.refillCount}회</span>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  accountStore.refill();
                  push("무료 시드 10,000 USDT 지급 완료!", "success");
                }}
                className={cn(
                  "flex items-center gap-1.5 rounded-md border px-3 py-2 text-[11px] font-medium transition-colors",
                  available < REFILL_THRESHOLD
                    ? "border-brand/50 bg-brand/10 text-brand hover:bg-brand/20"
                    : "border-line text-muted hover:text-txt",
                )}
              >
                <RefreshCw className="h-3 w-3" /> 무료 시드 +10,000 USDT
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("모의 계좌를 초기화할까요? 포지션·주문·거래내역이 모두 삭제됩니다.")) {
                    accountStore.reset();
                    push("모의 계좌가 10,000 USDT로 초기화되었습니다.", "info");
                  }
                }}
                className="flex items-center gap-1.5 rounded-md border border-line px-3 py-2 text-[11px] text-muted transition-colors hover:border-down/40 hover:text-down"
              >
                <RotateCcw className="h-3 w-3" /> 계정 초기화
              </button>
              <Link
                href="/ranking"
                className="flex items-center gap-1.5 rounded-md border border-line px-3 py-2 text-[11px] text-muted transition-colors hover:text-brand"
              >
                <ArrowUpRight className="h-3 w-3" /> 랭킹에서 내 순위 보기
              </Link>
            </div>

            <p className="text-[9px] leading-relaxed text-muted/60">
              {profile.nickname}님의 계좌는 이 브라우저에만 저장됩니다(로컬 모드). Supabase를 연결하면
              계정별로 서버에 저장됩니다. 청산·펀딩은 모의 엔진이 실시간 마크가격 기준으로 계산합니다.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function fmtUsdd(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}
