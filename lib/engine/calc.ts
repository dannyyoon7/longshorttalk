import {
  MAINTENANCE_MARGIN_RATE,
  SYMBOL_META,
  type Symbol,
} from "@/lib/constants";
import type { Side } from "./types";

export function notionalOf(price: number, qty: number): number {
  return price * qty;
}

export function unrealizedPnl(
  position: { side: Side; entryPrice: number; qty: number },
  markPrice: number,
): number {
  const diff = markPrice - position.entryPrice;
  return diff * position.qty * (position.side === "LONG" ? 1 : -1);
}

export function roePercent(pnl: number, margin: number): number {
  if (!margin) return 0;
  return (pnl / margin) * 100;
}

export function initialMargin(price: number, qty: number, leverage: number): number {
  return (price * qty) / Math.max(leverage, 1);
}

export function maintenanceMargin(price: number, qty: number): number {
  return price * qty * MAINTENANCE_MARGIN_RATE;
}

/**
 * 청산가 추정.
 * - 격리: 해당 포지션의 증거금만 위험에 노출
 * - 교차: 지갑 잔고 전체가 증거금 (다른 포지션 손익은 단순화를 위해 제외)
 * 유지증거금률 0.4% 기준. 실제 거래소의 청산가는 수수료·펀딩·증거금 단계에 따라 달라질 수 있다.
 */
export function liquidationPrice(params: {
  side: Side;
  entryPrice: number;
  qty: number;
  margin: number;
  marginMode: "CROSS" | "ISOLATED";
  walletBalance: number;
  mmr?: number;
}): number | null {
  const { side, entryPrice, qty, margin, marginMode, walletBalance } = params;
  const mmr = params.mmr ?? MAINTENANCE_MARGIN_RATE;
  if (qty <= 0) return null;
  const backing = marginMode === "ISOLATED" ? margin : walletBalance;
  const notional = entryPrice * qty;

  if (side === "LONG") {
    const price = (notional - backing) / (qty * (1 - mmr));
    return price > 0 ? price : null;
  }
  const price = (notional + backing) / (qty * (1 + mmr));
  return price > 0 ? price : null;
}

export function takerFee(price: number, qty: number, rate: number): number {
  return price * qty * rate;
}

/** 펀딩 정산액: 양수면 받는 금액, 음수면 내는 금액 */
export function fundingAmount(
  position: { side: Side; qty: number },
  markPrice: number,
  fundingRate: number,
): number {
  const notional = markPrice * position.qty;
  return notional * fundingRate * (position.side === "LONG" ? -1 : 1);
}

export function maxQuantity(params: {
  symbol: Symbol;
  available: number;
  leverage: number;
  price: number;
  percent: number;
}): number {
  const { symbol, available, leverage, price, percent } = params;
  if (price <= 0 || available <= 0) return 0;
  const meta = SYMBOL_META[symbol];
  const raw = (available * (percent / 100) * leverage) / price;
  const stepped = Math.floor(raw / meta.qtyStep) * meta.qtyStep;
  return Number(stepped.toFixed(6));
}

export function isValidTpSl(params: {
  side: Side;
  entry: number;
  tp?: number;
  sl?: number;
}): { ok: boolean; message?: string } {
  const { side, entry, tp, sl } = params;
  if (tp !== undefined) {
    if (!Number.isFinite(tp) || tp <= 0) return { ok: false, message: "TP 가격이 올바르지 않습니다." };
    if (side === "LONG" && tp <= entry)
      return { ok: false, message: "롱 포지션의 익절(TP)은 진입가보다 높아야 합니다." };
    if (side === "SHORT" && tp >= entry)
      return { ok: false, message: "숏 포지션의 익절(TP)은 진입가보다 낮아야 합니다." };
  }
  if (sl !== undefined) {
    if (!Number.isFinite(sl) || sl <= 0) return { ok: false, message: "SL 가격이 올바르지 않습니다." };
    if (side === "LONG" && sl >= entry)
      return { ok: false, message: "롱 포지션의 손절(SL)은 진입가보다 낮아야 합니다." };
    if (side === "SHORT" && sl <= entry)
      return { ok: false, message: "숏 포지션의 손절(SL)은 진입가보다 높아야 합니다." };
  }
  return { ok: true };
}

export function liquidationDistancePercent(entry: number, liq: number | null): number {
  if (!liq || entry <= 0) return 0;
  return Math.abs((liq - entry) / entry) * 100;
}

export function roundMoney(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
