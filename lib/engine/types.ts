import type { Symbol } from "@/lib/constants";
import type { PriceMap } from "@/lib/market/types";

export type Side = "LONG" | "SHORT";
export type OrderType = "MARKET" | "LIMIT";
export type MarginMode = "CROSS" | "ISOLATED";
export type OrderSide = "BUY" | "SELL";

export type Position = {
  id: string;
  symbol: Symbol;
  side: Side;
  entryPrice: number;
  qty: number;
  leverage: number;
  marginMode: MarginMode;
  /** 초기 증거금 (USDT) */
  margin: number;
  liquidationPrice: number;
  tp?: number;
  sl?: number;
  openedAt: number;
  fees: number;
};

export type Order = {
  id: string;
  symbol: Symbol;
  side: Side;
  type: OrderType;
  /** 지정가 주문 가격 */
  price: number;
  qty: number;
  leverage: number;
  marginMode: MarginMode;
  tp?: number;
  sl?: number;
  margin: number;
  createdAt: number;
};

export type TradeAction = "OPEN" | "CLOSE" | "TP" | "SL" | "LIQUIDATION" | "FUNDING";

export type TradeRecord = {
  id: string;
  symbol: Symbol;
  action: TradeAction;
  side: Side;
  price: number;
  qty: number;
  fee: number;
  pnl: number;
  roe: number;
  leverage: number;
  createdAt: number;
};

export type AccountState = {
  walletBalance: number;
  /** 누적 입금 (시드 리필 포함) */
  deposits: number;
  positions: Position[];
  orders: Order[];
  trades: TradeRecord[];
  fundingAppliedAt: Partial<Record<Symbol, number>>;
  refillCount: number;
  createdAt: number;
  version: number;
};

export type PlaceOrderInput = {
  symbol: Symbol;
  side: Side;
  type: OrderType;
  price?: number;
  qty: number;
  leverage: number;
  marginMode: MarginMode;
  tp?: number;
  sl?: number;
};

export type PlaceOrderResult = { ok: true; message: string } | { ok: false; message: string };

export type MarketPrices = PriceMap;

export type EngineEvent =
  | { kind: "order-filled"; symbol: Symbol; side: Side; price: number; qty: number; orderType: OrderType }
  | { kind: "position-closed"; symbol: Symbol; side: Side; pnl: number; roe: number; action: TradeAction }
  | { kind: "funding"; symbol: Symbol; amount: number }
  | { kind: "liquidated"; symbol: Symbol; side: Side; pnl: number };
