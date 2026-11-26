"use client";

import { useEffect, useMemo, useState } from "react";
import { Calculator } from "lucide-react";
import { SYMBOL_META, SYMBOLS, TAKER_FEE_RATE, type Symbol } from "@/lib/constants";
import {
  initialMargin,
  liquidationDistancePercent,
  liquidationPrice,
  maintenanceMargin,
  takerFee,
} from "@/lib/engine/calc";

const TAKER_FEE_LABEL = "Taker 0.05% 기준";
import { useMarketPrices } from "@/components/providers/MarketProvider";
import { cn, fmtPct, fmtPrice, fmtQty, fmtUsdt } from "@/lib/utils";

type Side = "LONG" | "SHORT";
type MarginMode = "ISOLATED" | "CROSS";

export function LiquidationCalculator() {
  const { prices, symbol, setSymbol } = useMarketPrices();
  const [side, setSide] = useState<Side>("LONG");
  const [mode, setMode] = useState<MarginMode>("ISOLATED");
  const [leverage, setLeverage] = useState(20);
  const [margin, setMargin] = useState("1000");
  const [wallet, setWallet] = useState("10000");
  const [entry, setEntry] = useState("");
  const [entryTouched, setEntryTouched] = useState(false);

  const meta = SYMBOL_META[symbol];
  const livePrice = prices[symbol].mark || prices[symbol].last;

  useEffect(() => {
    if (!entryTouched && livePrice > 0) setEntry(String(Number(livePrice.toFixed(meta.pricePrecision))));
  }, [livePrice, entryTouched, meta.pricePrecision]);

  useEffect(() => {
    setEntryTouched(false);
  }, [symbol]);

  const entryPrice = Number(entry) || 0;
  const marginAmount = Number(margin) || 0;
  const walletBalance = Number(wallet) || 0;
  const qty = entryPrice > 0 ? (marginAmount * leverage) / entryPrice : 0;
  const notional = entryPrice * qty;

  const liq = useMemo(
    () =>
      liquidationPrice({
        side,
        entryPrice,
        qty,
        margin: marginAmount,
        marginMode: mode,
        walletBalance,
      }),
    [side, entryPrice, qty, marginAmount, mode, walletBalance],
  );

  const distance = liquidationDistancePercent(entryPrice, liq);
  const fee = takerFee(entryPrice, qty, TAKER_FEE_RATE);
  const mm = maintenanceMargin(entryPrice, qty);

  return (
    <section
      id="calculator"
      className="scroll-mt-20 rounded-xl border border-line bg-panel p-4 sm:p-5"
    >
      <h2 className="flex items-center gap-2 text-[15px] font-bold text-txt">
        <Calculator className="h-4 w-4 text-brand" /> 청산가 계산기
      </h2>
      <p className="mt-1 text-[11.5px] text-muted">
        레버리지·증거금·진입가를 넣으면 예상 청산가와 청산까지의 거리를 계산합니다. (유지증거금률
        0.4% 기준)
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="flex rounded-md border border-line bg-panel2 p-0.5">
          {SYMBOLS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSymbol(s)}
              className={cn(
                "flex-1 rounded px-2 py-1.5 text-[11px] font-medium",
                s === symbol ? "bg-panel3 text-txt" : "text-muted",
              )}
            >
              {SYMBOL_META[s].base}/USDT
            </button>
          ))}
        </div>
        <div className="flex rounded-md border border-line bg-panel2 p-0.5">
          {(["LONG", "SHORT"] as Side[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSide(s)}
              className={cn(
                "flex-1 rounded px-2 py-1.5 text-[11px] font-medium",
                side === s
                  ? s === "LONG"
                    ? "bg-up/15 text-up"
                    : "bg-down/15 text-down"
                  : "text-muted",
              )}
            >
              {s === "LONG" ? "롱 (매수)" : "숏 (매도)"}
            </button>
          ))}
        </div>
        <div className="flex rounded-md border border-line bg-panel2 p-0.5">
          {(["ISOLATED", "CROSS"] as MarginMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                "flex-1 rounded px-2 py-1.5 text-[11px] font-medium",
                mode === m ? "bg-panel3 text-txt" : "text-muted",
              )}
            >
              {m === "ISOLATED" ? "격리" : "교차"}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 rounded-md border border-line bg-panel2 px-2.5 py-1.5">
          <span className="w-20 shrink-0 text-[10px] text-muted">레버리지</span>
          <input
            type="range"
            min={1}
            max={meta.maxLeverage}
            value={leverage}
            onChange={(e) => setLeverage(Number(e.target.value))}
            className="w-full accent-brand"
          />
          <span className="tnum w-10 shrink-0 text-right text-[11px] font-bold text-brand">
            {leverage}x
          </span>
        </label>

        <label className="block">
          <span className="text-[10px] text-muted">진입가 (USDT)</span>
          <input
            type="number"
            inputMode="decimal"
            value={entry}
            onChange={(e) => {
              setEntry(e.target.value);
              setEntryTouched(true);
            }}
            className="tnum mt-1 w-full rounded-md border border-line bg-panel2 px-2.5 py-1.5 text-right text-[12px] text-txt outline-none focus:border-brand/60"
          />
        </label>
        <label className="block">
          <span className="text-[10px] text-muted">증거금 (USDT)</span>
          <input
            type="number"
            inputMode="decimal"
            value={margin}
            onChange={(e) => setMargin(e.target.value)}
            className="tnum mt-1 w-full rounded-md border border-line bg-panel2 px-2.5 py-1.5 text-right text-[12px] text-txt outline-none focus:border-brand/60"
          />
        </label>
        {mode === "CROSS" && (
          <label className="block sm:col-span-2">
            <span className="text-[10px] text-muted">지갑 잔고 (교차 증거금, USDT)</span>
            <input
              type="number"
              inputMode="decimal"
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              className="tnum mt-1 w-full rounded-md border border-line bg-panel2 px-2.5 py-1.5 text-right text-[12px] text-txt outline-none focus:border-brand/60"
            />
          </label>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="col-span-2 rounded-lg border border-down/30 bg-down/5 p-3 sm:col-span-1">
          <p className="text-[10px] text-muted">예상 청산가</p>
          <p className="tnum mt-1 text-[16px] font-bold text-down">
            {liq ? fmtPrice(symbol, liq) : "청산 위험 없음"}
          </p>
          <p className="tnum mt-0.5 text-[9px] text-muted">
            진입가 대비 {liq ? fmtPct(-distance) : "—"}
          </p>
        </div>
        <div className="rounded-lg border border-line bg-panel2/50 p-3">
          <p className="text-[10px] text-muted">포지션 규모</p>
          <p className="tnum mt-1 text-[13px] font-semibold text-txt">{fmtUsdt(notional)}</p>
          <p className="tnum mt-0.5 text-[9px] text-muted">
            {fmtQty(qty, 4)} {meta.base}
          </p>
        </div>
        <div className="rounded-lg border border-line bg-panel2/50 p-3">
          <p className="text-[10px] text-muted">개시 수수료 (Taker)</p>
          <p className="tnum mt-1 text-[13px] font-semibold text-txt">{fmtUsdt(fee, 3)}</p>
          <p className="mt-0.5 text-[9px] text-muted">{TAKER_FEE_LABEL}</p>
        </div>
        <div className="rounded-lg border border-line bg-panel2/50 p-3">
          <p className="text-[10px] text-muted">유지증거금</p>
          <p className="tnum mt-1 text-[13px] font-semibold text-txt">{fmtUsdt(mm, 2)}</p>
          <p className="mt-0.5 text-[9px] text-muted">0.4% 기준</p>
        </div>
      </div>

      <p className="mt-2.5 text-[10px] leading-relaxed text-muted/70">
        개시증거금 {fmtUsdt(initialMargin(entryPrice, qty, leverage))} USDT · 실제 거래소의 청산가는
        수수료·펀딩·증거금 단계에 따라 달라질 수 있습니다. 교차 모드는 지갑 잔고 전체를 담보로
        계산합니다.
      </p>

      <div className="mt-3 overflow-hidden rounded-lg border border-line">
        <table className="w-full text-left text-[10.5px]">
          <thead className="bg-panel2 text-[9px] text-muted">
            <tr>
              <th className="px-2.5 py-1.5 font-medium">레버리지</th>
              <th className="px-2.5 py-1.5 text-right font-medium">격리 청산 거리</th>
              <th className="px-2.5 py-1.5 text-right font-medium">청산가</th>
            </tr>
          </thead>
          <tbody>
            {[2, 5, 10, 20, 50, 100, meta.maxLeverage]
              .filter((value, index, arr) => arr.indexOf(value) === index && value <= meta.maxLeverage)
              .map((value) => {
                const sample = liqAt(entryPrice, value, side, marginAmount);
                return (
                  <tr key={value} className="border-t border-line/60">
                    <td className="px-2.5 py-1.5 text-txt">{value}x</td>
                    <td className="tnum px-2.5 py-1.5 text-right text-muted">
                      {entryPrice ? fmtPct(-liquidationDistancePercent(entryPrice, sample)) : "—"}
                    </td>
                    <td className={cn("tnum px-2.5 py-1.5 text-right", side === "LONG" ? "text-down" : "text-down")}>
                      {sample ? fmtPrice(symbol, sample) : "—"}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function liqAt(entry: number, leverage: number, side: Side, margin: number): number | null {
  if (!entry || !margin) return null;
  const qty = (margin * leverage) / entry;
  return liquidationPrice({ side, entryPrice: entry, qty, margin, marginMode: "ISOLATED", walletBalance: 0 });
}
