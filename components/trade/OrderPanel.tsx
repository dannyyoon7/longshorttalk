"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Info, Minus, Plus, ShieldAlert, Zap } from "lucide-react";
import {
  MAINTENANCE_MARGIN_RATE,
  MAKER_FEE_RATE,
  SYMBOL_META,
  TAKER_FEE_RATE,
  type Symbol,
} from "@/lib/constants";
import {
  initialMargin,
  liquidationPrice,
  maxQuantity,
  takerFee,
} from "@/lib/engine/calc";
import { accountStore, availableOf } from "@/lib/engine/store";
import type { MarginMode, OrderType, Side } from "@/lib/engine/types";
import { useAccount } from "@/lib/engine/useAccount";
import { useToast } from "@/components/providers/ToastProvider";
import { useMarketPrices } from "@/components/providers/MarketProvider";
import { cn, fmtPct, fmtPrice, fmtQty, fmtUsdt } from "@/lib/utils";

type Props = {
  preset: { price: number; ts: number } | null;
};

const PERCENTS = [25, 50, 75, 100];

export function OrderPanel({ preset }: Props) {
  const { symbol, prices } = useMarketPrices();
  const account = useAccount();
  const { push } = useToast();
  const meta = SYMBOL_META[symbol];
  const ticker = prices[symbol];
  const position = account.positions.find((p) => p.symbol === symbol);

  const [marginMode, setMarginMode] = useState<MarginMode>(position?.marginMode ?? "CROSS");
  const [leverage, setLeverage] = useState(position?.leverage ?? 10);
  const [type, setType] = useState<OrderType>("MARKET");
  const [priceInput, setPriceInput] = useState("");
  const [qtyInput, setQtyInput] = useState("");
  const [tpOn, setTpOn] = useState(false);
  const [slOn, setSlOn] = useState(false);
  const [tpInput, setTpInput] = useState("");
  const [slInput, setSlInput] = useState("");
  const [advanced, setAdvanced] = useState(false);

  useEffect(() => {
    setPriceInput("");
    setQtyInput("");
    setTpInput("");
    setSlInput("");
    setType("MARKET");
    const current = account.positions.find((p) => p.symbol === symbol);
    setLeverage(current?.leverage ?? Math.min(leverage || 10, meta.maxLeverage));
    setMarginMode(current?.marginMode ?? "CROSS");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  useEffect(() => {
    if (!preset) return;
    setType("LIMIT");
    setPriceInput(String(preset.price));
    setAdvanced(true);
  }, [preset]);

  const markPrice = ticker.mark || ticker.last;
  const lastPrice = ticker.last || ticker.mark;
  const effectivePrice = type === "LIMIT" ? Number(priceInput) || 0 : lastPrice;
  const qty = Number(qtyInput) || 0;
  const notional = effectivePrice * qty;
  const margin = initialMargin(effectivePrice, qty || 0, leverage);
  const feeRate = type === "MARKET" ? TAKER_FEE_RATE : MAKER_FEE_RATE;
  const fee = takerFee(effectivePrice, qty || 0, feeRate);
  const available = availableOf(account, prices);
  const maxQty = maxQuantity({
    symbol,
    available,
    leverage,
    price: effectivePrice || lastPrice,
    percent: 100,
  });

  const liqLong = useMemo(
    () =>
      liquidationPrice({
        side: "LONG",
        entryPrice: effectivePrice || lastPrice,
        qty: qty || 0,
        margin,
        marginMode,
        walletBalance: account.walletBalance,
      }),
    [effectivePrice, lastPrice, qty, margin, marginMode, account.walletBalance],
  );
  const liqShort = useMemo(
    () =>
      liquidationPrice({
        side: "SHORT",
        entryPrice: effectivePrice || lastPrice,
        qty: qty || 0,
        margin,
        marginMode,
        walletBalance: account.walletBalance,
      }),
    [effectivePrice, lastPrice, qty, margin, marginMode, account.walletBalance],
  );

  const tpPct =
    tpInput && effectivePrice
      ? ((Number(tpInput) - effectivePrice) / effectivePrice) * 100
      : null;
  const slPct =
    slInput && effectivePrice
      ? ((Number(slInput) - effectivePrice) / effectivePrice) * 100
      : null;

  const leverageLocked = Boolean(position);
  const modeLocked = Boolean(position);

  function setLeverageSafe(next: number) {
    if (leverageLocked) {
      push("포지션 보유 중에는 레버리지를 변경할 수 없습니다. 먼저 포지션을 종료해 주세요.", "error");
      return;
    }
    setLeverage(Math.min(Math.max(Math.round(next), 1), meta.maxLeverage));
  }

  function applyPercent(percent: number) {
    const amount = maxQuantity({
      symbol,
      available,
      leverage,
      price: effectivePrice || lastPrice,
      percent,
    });
    setQtyInput(amount > 0 ? String(amount) : "");
  }

  function submit(side: Side) {
    const result = accountStore.placeOrder(
      {
        symbol,
        side,
        type,
        price: type === "LIMIT" ? Number(priceInput) : undefined,
        qty,
        leverage,
        marginMode,
        tp: tpOn && tpInput ? Number(tpInput) : undefined,
        sl: slOn && slInput ? Number(slInput) : undefined,
      },
      prices,
    );
    push(result.message, result.ok ? "success" : "error");
    if (result.ok) setQtyInput("");
  }

  return (
    <section className="panel flex flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <p className="text-[12px] font-semibold text-txt">주문</p>
        <span className="flex items-center gap-1 rounded bg-panel2 px-1.5 py-0.5 text-[9px] text-muted">
          <ShieldAlert className="h-2.5 w-2.5" /> 모의 주문
        </span>
      </div>

      <div className="space-y-3 px-3 py-3">
        <div className="flex rounded-md border border-line bg-panel2 p-0.5">
          {(["CROSS", "ISOLATED"] as MarginMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              disabled={modeLocked}
              onClick={() => setMarginMode(mode)}
              className={cn(
                "flex-1 rounded px-2 py-1.5 text-[11px] font-medium transition-colors",
                marginMode === mode ? "bg-panel3 text-txt" : "text-muted hover:text-txt",
                modeLocked && "cursor-not-allowed opacity-60",
              )}
              title={
                mode === "CROSS"
                  ? "교차: 지갑 잔고 전체를 증거금으로 사용 (청산가가 멀지만 손실이 클 수 있음)"
                  : "격리: 해당 포지션 증거금만 위험에 노출 (청산가가 가깝지만 손실 한정)"
              }
            >
              {mode === "CROSS" ? "교차" : "격리"}
            </button>
          ))}
        </div>

        <div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-[11px] text-muted">
              레버리지
              <Info className="h-3 w-3 text-muted/60" />
            </span>
            <span className="tnum rounded bg-panel2 px-1.5 py-0.5 text-[11px] font-bold text-brand">
              {leverage}x
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLeverageSafe(leverage - 1)}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-line text-muted hover:text-txt"
              aria-label="레버리지 낮추기"
            >
              <Minus className="h-3 w-3" />
            </button>
            <input
              type="range"
              min={1}
              max={meta.maxLeverage}
              step={1}
              value={leverage}
              disabled={leverageLocked}
              onChange={(e) => setLeverageSafe(Number(e.target.value))}
              className="w-full accent-brand disabled:opacity-50"
              aria-label="레버리지"
            />
            <button
              type="button"
              onClick={() => setLeverageSafe(leverage + 1)}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-line text-muted hover:text-txt"
              aria-label="레버리지 높이기"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
          <div className="mt-1.5 flex gap-1">
            {[5, 10, 20, 50, meta.maxLeverage].map((value, index) => (
              <button
                key={`${value}-${index}`}
                type="button"
                disabled={leverageLocked}
                onClick={() => setLeverageSafe(value)}
                className={cn(
                  "flex-1 rounded border px-1 py-1 text-[10px] transition-colors",
                  leverage === value
                    ? "border-brand/50 bg-brand/10 text-brand"
                    : "border-line text-muted hover:text-txt",
                  leverageLocked && "cursor-not-allowed opacity-50",
                )}
              >
                {index === 4 ? "MAX" : `${value}x`}
              </button>
            ))}
          </div>
        </div>

        <div className="flex rounded-md border border-line bg-panel2 p-0.5">
          {(["MARKET", "LIMIT"] as OrderType[]).map((orderType) => (
            <button
              key={orderType}
              type="button"
              onClick={() => setType(orderType)}
              className={cn(
                "flex-1 rounded px-2 py-1.5 text-[11px] font-medium transition-colors",
                type === orderType ? "bg-panel3 text-txt" : "text-muted hover:text-txt",
              )}
            >
              {orderType === "MARKET" ? "시장가" : "지정가"}
            </button>
          ))}
        </div>

        <label className="block">
          <span className="text-[11px] text-muted">가격 (USDT)</span>
          <input
            type="number"
            inputMode="decimal"
            data-testid="order-price"
            value={type === "MARKET" ? "" : priceInput}
            disabled={type === "MARKET"}
            onChange={(e) => setPriceInput(e.target.value)}
            placeholder={type === "MARKET" ? "시장가 (현재가 체결)" : lastPrice ? fmtPrice(symbol, lastPrice) : "가격 입력"}
            className={cn(
              "tnum mt-1 w-full rounded-md border border-line bg-panel2 px-2.5 py-2 text-right text-[13px] text-txt outline-none transition-colors placeholder:text-muted/60 focus:border-brand/60",
              type === "MARKET" && "text-muted",
            )}
          />
        </label>

        <label className="block">
          <span className="flex items-center justify-between text-[11px] text-muted">
            <span>수량 ({meta.base})</span>
            <span className="tnum text-[10px]">최대 {fmtQty(maxQty)}</span>
          </span>
          <div className="relative mt-1">
            <input
              type="number"
              inputMode="decimal"
              data-testid="order-qty"
              step={meta.qtyStep}
              min={0}
              value={qtyInput}
              onChange={(e) => setQtyInput(e.target.value)}
              placeholder="0"
              className="tnum w-full rounded-md border border-line bg-panel2 px-2.5 py-2 pr-12 text-right text-[13px] text-txt outline-none transition-colors placeholder:text-muted/60 focus:border-brand/60"
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted">
              {meta.base}
            </span>
          </div>
        </label>

        <div className="grid grid-cols-4 gap-1">
          {PERCENTS.map((percent) => (
            <button
              key={percent}
              type="button"
              onClick={() => applyPercent(percent)}
              className="rounded border border-line py-1 text-[10px] text-muted transition-colors hover:border-brand/40 hover:text-txt"
            >
              {percent}%
            </button>
          ))}
        </div>

        <div className="rounded-md border border-line/70 bg-panel2/50 px-2.5 py-2 text-[10px] leading-relaxed text-muted">
          <div className="flex items-center justify-between">
            <span>주문 가능</span>
            <span className="tnum text-txt">{fmtUsdt(available)} USDT</span>
          </div>
          <div className="mt-0.5 flex items-center justify-between">
            <span>주문금액 / 증거금</span>
            <span className="tnum text-txt">
              {fmtUsdt(notional)} / {fmtUsdt(margin)}
            </span>
          </div>
          <div className="mt-0.5 flex items-center justify-between">
            <span>수수료 ({type === "MARKET" ? "Taker" : "Maker"})</span>
            <span className="tnum">{fmtUsdt(fee, 3)} USDT</span>
          </div>
          <div className="mt-0.5 flex items-center justify-between">
            <span>예상 청산가</span>
            <span className="tnum">
              <span className="text-up">{liqLong ? fmtPrice(symbol, liqLong) : "없음"}</span>
              <span className="mx-1 text-muted">/</span>
              <span className="text-down">{liqShort ? fmtPrice(symbol, liqShort) : "없음"}</span>
            </span>
          </div>
          <p className="mt-1 text-[9px] text-muted/70">
            청산가는 유지증거금률 {(MAINTENANCE_MARGIN_RATE * 100).toFixed(1)}% 기준 추정치입니다.
            교차 모드에서 지갑 잔고가 충분하면 청산가가 형성되지 않아 &lsquo;없음&rsquo;으로 표시됩니다.
          </p>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setAdvanced((v) => !v)}
            className="flex w-full items-center justify-between rounded border border-line px-2.5 py-1.5 text-[11px] text-muted transition-colors hover:text-txt"
          >
            <span className="flex items-center gap-1.5">
              <Zap className="h-3 w-3 text-brand" /> TP / SL 동시 설정
            </span>
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", advanced && "rotate-180")} />
          </button>

          {advanced && (
            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTpOn((v) => !v)}
                  className={cn(
                    "w-10 shrink-0 rounded border px-1 py-1.5 text-[10px] font-medium",
                    tpOn ? "border-up/50 bg-up/10 text-up" : "border-line text-muted",
                  )}
                >
                  TP
                </button>
                <input
                  type="number"
                  inputMode="decimal"
                  value={tpInput}
                  disabled={!tpOn}
                  onChange={(e) => setTpInput(e.target.value)}
                  placeholder="익절 가격"
                  className="tnum w-full rounded border border-line bg-panel2 px-2 py-1.5 text-right text-[12px] text-txt outline-none focus:border-up/50 disabled:opacity-50"
                />
                <span className="tnum w-14 shrink-0 text-right text-[10px] text-muted">
                  {tpPct === null ? "—" : fmtPct(tpPct)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSlOn((v) => !v)}
                  className={cn(
                    "w-10 shrink-0 rounded border px-1 py-1.5 text-[10px] font-medium",
                    slOn ? "border-down/50 bg-down/10 text-down" : "border-line text-muted",
                  )}
                >
                  SL
                </button>
                <input
                  type="number"
                  inputMode="decimal"
                  value={slInput}
                  disabled={!slOn}
                  onChange={(e) => setSlInput(e.target.value)}
                  placeholder="손절 가격"
                  className="tnum w-full rounded border border-line bg-panel2 px-2 py-1.5 text-right text-[12px] text-txt outline-none focus:border-down/50 disabled:opacity-50"
                />
                <span className="tnum w-14 shrink-0 text-right text-[10px] text-muted">
                  {slPct === null ? "—" : fmtPct(slPct)}
                </span>
              </div>
              <p className="text-[9px] text-muted/70">
                체결 후 마크가격이 TP/SL에 도달하면 자동으로 시장가 종료됩니다.
              </p>
            </div>
          )}
        </div>

        {position && (
          <div className="rounded border border-brand/20 bg-brand/[0.06] px-2.5 py-1.5 text-[10px] text-brand">
            {meta.base} {position.leverage}x {position.side === "LONG" ? "롱" : "숏"} 포지션 보유 중 ·
            같은 방향 주문은 평균 진입가로 합산됩니다.
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 pt-0.5">
          <button
            type="button"
            onClick={() => submit("LONG")}
            className="group flex flex-col items-center rounded-md border border-up/40 bg-up/10 py-2.5 transition-colors hover:bg-up/20"
          >
            <span className="text-[12px] font-bold text-up">롱 (Long)</span>
            <span className="tnum mt-0.5 text-[10px] text-up/80">
              {lastPrice ? fmtPrice(symbol, lastPrice) : "—"} · {leverage}x
            </span>
          </button>
          <button
            type="button"
            onClick={() => submit("SHORT")}
            className="flex flex-col items-center rounded-md border border-down/40 bg-down/10 py-2.5 transition-colors hover:bg-down/20"
          >
            <span className="text-[12px] font-bold text-down">숏 (Short)</span>
            <span className="tnum mt-0.5 text-[10px] text-down/80">
              {lastPrice ? fmtPrice(symbol, lastPrice) : "—"} · {leverage}x
            </span>
          </button>
        </div>

        {available < 100 && (
          <button
            type="button"
            onClick={() => {
              accountStore.refill();
              push("무료 시드 10,000 USDT가 지급되었습니다.", "success");
            }}
            className="w-full rounded border border-brand/40 bg-brand/10 py-1.5 text-[11px] font-medium text-brand hover:bg-brand/20"
          >
            잔고 부족 · 무료 시드 +10,000 USDT
          </button>
        )}

        <p className="text-center text-[9px] text-muted/60">
          모의투자입니다. 실제 주문·입출금은 발생하지 않습니다.
        </p>
      </div>
    </section>
  );
}
