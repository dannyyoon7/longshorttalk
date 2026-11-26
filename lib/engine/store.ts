import {
  INITIAL_BALANCE,
  MAKER_FEE_RATE,
  REFILL_AMOUNT,
  STORAGE_KEYS,
  SYMBOL_META,
  SYMBOLS,
  TAKER_FEE_RATE,
  type Symbol,
} from "@/lib/constants";
import type { PriceMap } from "@/lib/market/types";
import { roundToStep, uid } from "@/lib/utils";
import {
  fundingAmount,
  initialMargin,
  isValidTpSl,
  liquidationPrice,
  roundMoney,
  takerFee,
  unrealizedPnl,
} from "./calc";
import type {
  AccountState,
  EngineEvent,
  Order,
  PlaceOrderInput,
  PlaceOrderResult,
  Position,
  Side,
  TradeAction,
  TradeRecord,
} from "./types";

const SERVER_STATE: AccountState = {
  walletBalance: INITIAL_BALANCE,
  deposits: INITIAL_BALANCE,
  positions: [],
  orders: [],
  trades: [],
  fundingAppliedAt: {},
  refillCount: 0,
  createdAt: 0,
  version: 0,
};

function createInitialState(): AccountState {
  return { ...SERVER_STATE, createdAt: Date.now(), positions: [], orders: [], trades: [] };
}

function num(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function equityOf(state: AccountState, prices: PriceMap): number {
  let equity = state.walletBalance;
  for (const position of state.positions) {
    equity += unrealizedPnl(position, prices[position.symbol].mark || prices[position.symbol].last);
  }
  return equity;
}

export function availableOf(state: AccountState, prices?: PriceMap): number {
  const locked =
    state.positions.reduce((sum, p) => sum + p.margin, 0) +
    state.orders.reduce((sum, o) => sum + o.margin, 0);
  let equity = state.walletBalance;
  if (prices) {
    for (const position of state.positions) {
      equity += unrealizedPnl(position, prices[position.symbol].mark || prices[position.symbol].last);
    }
  }
  return Math.max(0, roundMoney(equity - locked));
}

export function totalUnrealized(state: AccountState, prices: PriceMap): number {
  return state.positions.reduce(
    (sum, p) => sum + unrealizedPnl(p, prices[p.symbol].mark || prices[p.symbol].last),
    0,
  );
}

class AccountStore {
  private state: AccountState = SERVER_STATE;
  private listeners = new Set<() => void>();
  private eventListeners = new Set<(event: EngineEvent) => void>();
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private hydrated = false;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getState = (): AccountState => this.state;

  getServerState = (): AccountState => SERVER_STATE;

  onEvent = (listener: (event: EngineEvent) => void): (() => void) => {
    this.eventListeners.add(listener);
    return () => {
      this.eventListeners.delete(listener);
    };
  };

  hydrate(): void {
    if (this.hydrated || typeof window === "undefined") return;
    this.hydrated = true;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.account);
      if (!raw) {
        this.commit(createInitialState(), false);
        return;
      }
      const parsed = JSON.parse(raw) as Partial<AccountState>;
      const positions = Array.isArray(parsed.positions)
        ? parsed.positions.filter((p) => p && typeof p.symbol === "string" && num(p.qty) > 0)
        : [];
      const orders = Array.isArray(parsed.orders)
        ? parsed.orders.filter((o) => o && typeof o.symbol === "string" && num(o.qty) > 0)
        : [];
      const trades = Array.isArray(parsed.trades) ? parsed.trades.slice(0, 200) : [];
      this.commit(
        {
          walletBalance: num(parsed.walletBalance, INITIAL_BALANCE),
          deposits: num(parsed.deposits, INITIAL_BALANCE),
          positions,
          orders,
          trades,
          fundingAppliedAt: parsed.fundingAppliedAt ?? {},
          refillCount: num(parsed.refillCount),
          createdAt: num(parsed.createdAt, Date.now()),
          version: this.state.version + 1,
        },
        false,
      );
    } catch {
      this.commit(createInitialState(), false);
    }
  }

  private emitEvent(event: EngineEvent): void {
    for (const listener of this.eventListeners) listener(event);
  }

  private commit(next: Partial<AccountState>, persist = true): void {
    this.state = { ...this.state, ...next, version: this.state.version + 1 };
    for (const listener of this.listeners) listener();
    if (persist) this.scheduleSave();
  }

  private scheduleSave(): void {
    if (typeof window === "undefined") return;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEYS.account, JSON.stringify(this.state));
      } catch {
        /* 저장 실패는 무시 (사생활 보호 모드 등) */
      }
    }, 250);
  }

  reset(): void {
    this.commit({ ...createInitialState(), version: this.state.version });
  }

  refill(): number {
    this.commit({
      walletBalance: roundMoney(this.state.walletBalance + REFILL_AMOUNT),
      deposits: roundMoney(this.state.deposits + REFILL_AMOUNT),
      refillCount: this.state.refillCount + 1,
    });
    return REFILL_AMOUNT;
  }

  placeOrder(input: PlaceOrderInput, prices: PriceMap): PlaceOrderResult {
    const meta = SYMBOL_META[input.symbol];
    const ticker = prices[input.symbol];
    const lastPrice = ticker.last || ticker.mark;
    if (!lastPrice) return { ok: false, message: "시세를 기다리는 중입니다. 잠시 후 다시 시도해 주세요." };

    const leverage = Math.round(input.leverage);
    if (leverage < 1 || leverage > meta.maxLeverage) {
      return { ok: false, message: `레버리지는 1x ~ ${meta.maxLeverage}x 범위입니다.` };
    }

    const qty = roundToStep(input.qty, meta.qtyStep);
    if (!Number.isFinite(qty) || qty < meta.minQty) {
      return { ok: false, message: `최소 주문 수량은 ${meta.minQty} ${meta.base}입니다.` };
    }

    const price = input.type === "LIMIT" ? Number(input.price) : lastPrice;
    if (!Number.isFinite(price) || price <= 0) {
      return { ok: false, message: "주문 가격을 확인해 주세요." };
    }
    if (price * qty < meta.minNotional) {
      return { ok: false, message: `최소 주문 금액은 ${meta.minNotional} USDT입니다.` };
    }

    const existing = this.state.positions.find((p) => p.symbol === input.symbol);
    if (existing) {
      if (existing.side !== input.side) {
        return {
          ok: false,
          message: `${meta.base} ${existing.side === "LONG" ? "롱" : "숏"} 포지션이 있습니다. 먼저 종료한 뒤 주문해 주세요.`,
        };
      }
      if (existing.marginMode !== input.marginMode) {
        return { ok: false, message: "보유 포지션의 교차/격리 모드를 먼저 맞춰 주세요." };
      }
      if (existing.leverage !== leverage) {
        return { ok: false, message: `보유 포지션의 레버리지(${existing.leverage}x)와 같아야 합니다.` };
      }
    }

    const check = isValidTpSl({
      side: input.side,
      entry: price,
      tp: input.tp,
      sl: input.sl,
    });
    if (!check.ok) return { ok: false, message: check.message ?? "TP/SL 값을 확인해 주세요." };

    const margin = initialMargin(price, qty, leverage);
    const feeRate = input.type === "MARKET" ? TAKER_FEE_RATE : MAKER_FEE_RATE;
    const fee = takerFee(price, qty, feeRate);
    const available = availableOf(this.state, prices);
    if (available < margin + fee) {
      return { ok: false, message: "주문 가능 금액이 부족합니다. 시드를 리필하거나 수량을 줄여 주세요." };
    }

    if (input.type === "MARKET") {
      this.fillOrder(input, price, qty, leverage, margin, TAKER_FEE_RATE, Date.now(), prices);
      return {
        ok: true,
        message: `${input.side === "LONG" ? "롱" : "숏"} ${qty} ${meta.base} 시장가 진입 완료`,
      };
    }

    const order: Order = {
      id: uid("ord"),
      symbol: input.symbol,
      side: input.side,
      type: "LIMIT",
      price,
      qty,
      leverage,
      marginMode: input.marginMode,
      tp: input.tp,
      sl: input.sl,
      margin,
      createdAt: Date.now(),
    };
    this.commit({ orders: [order, ...this.state.orders] });
    return {
      ok: true,
      message: `${price.toLocaleString("en-US")} 지정가 ${input.side === "LONG" ? "매수" : "매도"} 주문 접수 (미체결)`,
    };
  }

  cancelOrder(orderId: string): void {
    this.commit({ orders: this.state.orders.filter((o) => o.id !== orderId) });
  }

  closePosition(positionId: string, percent: number, prices: PriceMap): void {
    const position = this.state.positions.find((p) => p.id === positionId);
    if (!position) return;
    const meta = SYMBOL_META[position.symbol];
    const ticker = prices[position.symbol];
    const price = ticker.last || ticker.mark;
    if (!price) return;

    const ratio = Math.min(Math.max(percent, 1), 100) / 100;
    let qty = ratio >= 1 ? position.qty : roundToStep(position.qty * ratio, meta.qtyStep);
    if (qty <= 0) return;
    if (position.qty - qty < meta.minQty) qty = position.qty;

    this.executeClose(position, qty, price, "CLOSE", prices);
  }

  closeAll(prices: PriceMap): void {
    for (const position of [...this.state.positions]) {
      this.closePosition(position.id, 100, prices);
    }
  }

  /** 가격이 갱신될 때마다 호출: 지정가 체결 · TP/SL · 청산 · 펀딩 정산 */
  tick(prices: PriceMap): void {
    const now = Date.now();
    let state = this.state;
    const nextPositions = [...state.positions];
    const nextOrders = [...state.orders];
    const nextTrades = [...state.trades];
    const fundingAppliedAt = { ...state.fundingAppliedAt };
    let wallet = state.walletBalance;
    let changed = false;

    // 1) 지정가 주문 체결
    for (const order of [...nextOrders]) {
      const ticker = prices[order.symbol];
      const lastPrice = ticker.last || ticker.mark;
      if (!lastPrice) continue;
      const shouldFill =
        order.side === "LONG" ? lastPrice <= order.price : lastPrice >= order.price;
      if (!shouldFill) continue;

      nextOrders.splice(nextOrders.indexOf(order), 1);
      const position = nextPositions.find((p) => p.symbol === order.symbol);
      // 시장성 지정가는 더 유리한 가격(현재가)으로 체결한다.
      const fillPrice =
        order.side === "LONG" ? Math.min(order.price, lastPrice) : Math.max(order.price, lastPrice);
      const fee = takerFee(fillPrice, order.qty, MAKER_FEE_RATE);
      wallet = roundMoney(wallet - fee);

      if (position) {
        const newQty = position.qty + order.qty;
        position.entryPrice =
          (position.entryPrice * position.qty + fillPrice * order.qty) / newQty;
        position.qty = newQty;
        position.margin = roundMoney(position.margin + order.margin);
        position.fees = roundMoney(position.fees + fee);
        position.tp = order.tp ?? position.tp;
        position.sl = order.sl ?? position.sl;
        position.liquidationPrice =
          liquidationPrice({
            side: position.side,
            entryPrice: position.entryPrice,
            qty: position.qty,
            margin: position.margin,
            marginMode: position.marginMode,
            walletBalance: wallet,
          }) ?? 0;
      } else {
        const created: Position = {
          id: uid("pos"),
          symbol: order.symbol,
          side: order.side,
          entryPrice: fillPrice,
          qty: order.qty,
          leverage: order.leverage,
          marginMode: order.marginMode,
          margin: order.margin,
          liquidationPrice:
            liquidationPrice({
              side: order.side,
              entryPrice: fillPrice,
              qty: order.qty,
              margin: order.margin,
              marginMode: order.marginMode,
              walletBalance: wallet,
            }) ?? 0,
          tp: order.tp,
          sl: order.sl,
          openedAt: now,
          fees: fee,
        };
        nextPositions.push(created);
      }

      nextTrades.unshift({
        id: uid("trd"),
        symbol: order.symbol,
        action: "OPEN",
        side: order.side,
        price: fillPrice,
        qty: order.qty,
        fee,
        pnl: 0,
        roe: 0,
        leverage: order.leverage,
        createdAt: now,
      });
      this.emitEvent({
        kind: "order-filled",
        symbol: order.symbol,
        side: order.side,
        price: fillPrice,
        qty: order.qty,
        orderType: "LIMIT",
      });
      changed = true;
    }

    // 2) TP / SL / 강제청산
    for (const position of [...nextPositions]) {
      const ticker = prices[position.symbol];
      const mark = ticker.mark || ticker.last;
      if (!mark) continue;

      const liq =
        liquidationPrice({
          side: position.side,
          entryPrice: position.entryPrice,
          qty: position.qty,
          margin: position.margin,
          marginMode: position.marginMode,
          walletBalance: wallet,
        }) ?? 0;
      if (position.marginMode === "CROSS" && liq > 0) position.liquidationPrice = liq;

      const hitLiq = liq > 0 && (position.side === "LONG" ? mark <= liq : mark >= liq);
      const hitTp =
        position.tp !== undefined &&
        (position.side === "LONG" ? mark >= position.tp : mark <= position.tp);
      const hitSl =
        position.sl !== undefined &&
        (position.side === "LONG" ? mark <= position.sl : mark >= position.sl);

      if (!hitLiq && !hitTp && !hitSl) continue;

      const action: TradeAction = hitLiq ? "LIQUIDATION" : hitTp ? "TP" : "SL";
      const closePrice = hitLiq ? liq : mark;
      const idx = nextPositions.indexOf(position);
      if (idx >= 0) nextPositions.splice(idx, 1);

      const dir = position.side === "LONG" ? 1 : -1;
      let pnl = (closePrice - position.entryPrice) * position.qty * dir;
      let fee = hitLiq ? 0 : takerFee(closePrice, position.qty, TAKER_FEE_RATE);
      if (hitLiq && position.marginMode === "ISOLATED") {
        pnl = Math.max(pnl, -position.margin);
      }
      wallet = Math.max(0, roundMoney(wallet + pnl - fee));

      nextTrades.unshift({
        id: uid("trd"),
        symbol: position.symbol,
        action,
        side: position.side,
        price: closePrice,
        qty: position.qty,
        fee,
        pnl: roundMoney(pnl),
        roe: position.margin ? roundMoney((pnl / position.margin) * 100) : 0,
        leverage: position.leverage,
        createdAt: now,
      });
      this.emitEvent({
        kind: hitLiq ? "liquidated" : "position-closed",
        symbol: position.symbol,
        side: position.side,
        pnl: roundMoney(pnl),
        roe: position.margin ? roundMoney((pnl / position.margin) * 100) : 0,
        action,
      });
      changed = true;
    }

    // 3) 펀딩 정산 (포지션 유무와 관계없이 정산 시각을 소비한다)
    for (const symbol of SYMBOLS) {
      const ticker = prices[symbol];
      const mark = ticker.mark || ticker.last;
      const settleAt = ticker.nextFundingTime;
      if (!mark || !settleAt || !ticker.fundingRate) continue;
      if (now < settleAt) continue;
      if (fundingAppliedAt[symbol] === settleAt) continue;

      fundingAppliedAt[symbol] = settleAt;
      changed = true;

      for (const position of nextPositions.filter((p) => p.symbol === symbol)) {
        // 정산 시각 이전에 열린 포지션에만 펀딩이 적용된다.
        if (position.openedAt >= settleAt) continue;
        const amount = roundMoney(fundingAmount(position, mark, ticker.fundingRate));
        wallet = roundMoney(wallet + amount);
        nextTrades.unshift({
          id: uid("trd"),
          symbol,
          action: "FUNDING",
          side: position.side,
          price: mark,
          qty: position.qty,
          fee: 0,
          pnl: amount,
          roe: position.margin ? roundMoney((amount / position.margin) * 100) : 0,
          leverage: position.leverage,
          createdAt: now,
        });
        this.emitEvent({ kind: "funding", symbol, amount });
      }
    }

    if (!changed) return;

    this.commit({
      walletBalance: wallet,
      positions: nextPositions,
      orders: nextOrders,
      trades: nextTrades.slice(0, 200),
      fundingAppliedAt,
    });
  }

  private fillOrder(
    input: PlaceOrderInput,
    price: number,
    qty: number,
    leverage: number,
    margin: number,
    feeRate: number,
    ts: number,
    prices: PriceMap,
  ): void {
    const fee = takerFee(price, qty, feeRate);
    const wallet = roundMoney(this.state.walletBalance - fee);
    const positions = [...this.state.positions];
    const existing = positions.find((p) => p.symbol === input.symbol && p.side === input.side);

    if (existing) {
      const newQty = existing.qty + qty;
      existing.entryPrice = (existing.entryPrice * existing.qty + price * qty) / newQty;
      existing.qty = newQty;
      existing.margin = roundMoney(existing.margin + margin);
      existing.fees = roundMoney(existing.fees + fee);
      existing.tp = input.tp ?? existing.tp;
      existing.sl = input.sl ?? existing.sl;
      existing.liquidationPrice =
        liquidationPrice({
          side: existing.side,
          entryPrice: existing.entryPrice,
          qty: existing.qty,
          margin: existing.margin,
          marginMode: existing.marginMode,
          walletBalance: wallet,
        }) ?? 0;
    } else {
      positions.push({
        id: uid("pos"),
        symbol: input.symbol,
        side: input.side,
        entryPrice: price,
        qty,
        leverage,
        marginMode: input.marginMode,
        margin,
        liquidationPrice:
          liquidationPrice({
            side: input.side,
            entryPrice: price,
            qty,
            margin,
            marginMode: input.marginMode,
            walletBalance: wallet,
          }) ?? 0,
        tp: input.tp,
        sl: input.sl,
        openedAt: ts,
        fees: fee,
      });
    }

    const trade: TradeRecord = {
      id: uid("trd"),
      symbol: input.symbol,
      action: "OPEN",
      side: input.side,
      price,
      qty,
      fee,
      pnl: 0,
      roe: 0,
      leverage,
      createdAt: ts,
    };

    this.commit({
      walletBalance: wallet,
      positions,
      trades: [trade, ...this.state.trades].slice(0, 200),
    });
    this.emitEvent({
      kind: "order-filled",
      symbol: input.symbol,
      side: input.side,
      price,
      qty,
      orderType: "MARKET",
    });
    void prices;
  }

  private executeClose(
    position: Position,
    qty: number,
    price: number,
    action: TradeAction,
    prices: PriceMap,
  ): void {
    const meta = SYMBOL_META[position.symbol];
    const ratio = Math.min(qty / position.qty, 1);
    const marginPortion = roundMoney(position.margin * ratio);
    const dir = position.side === "LONG" ? 1 : -1;
    let pnl = (price - position.entryPrice) * qty * dir;
    const fee = takerFee(price, qty, TAKER_FEE_RATE);
    if (action === "LIQUIDATION" && position.marginMode === "ISOLATED") {
      pnl = Math.max(pnl, -marginPortion);
    }
    const wallet = Math.max(0, roundMoney(this.state.walletBalance + pnl - fee));

    const positions = [...this.state.positions];
    const idx = positions.findIndex((p) => p.id === position.id);
    let remainingQty = 0;
    if (idx >= 0) {
      const current = positions[idx];
      remainingQty = roundToStep(current.qty - qty, meta.qtyStep);
      if (remainingQty < meta.minQty) {
        positions.splice(idx, 1);
        remainingQty = 0;
      } else {
        const remainingMargin = roundMoney(current.margin - marginPortion);
        positions[idx] = {
          ...current,
          qty: remainingQty,
          margin: remainingMargin,
          liquidationPrice:
            liquidationPrice({
              side: current.side,
              entryPrice: current.entryPrice,
              qty: remainingQty,
              margin: remainingMargin,
              marginMode: current.marginMode,
              walletBalance: wallet,
            }) ?? 0,
        };
      }
    }

    const trade: TradeRecord = {
      id: uid("trd"),
      symbol: position.symbol,
      action,
      side: position.side,
      price,
      qty,
      fee,
      pnl: roundMoney(pnl),
      roe: marginPortion ? roundMoney((pnl / marginPortion) * 100) : 0,
      leverage: position.leverage,
      createdAt: Date.now(),
    };

    this.commit({
      walletBalance: wallet,
      positions,
      trades: [trade, ...this.state.trades].slice(0, 200),
    });
    this.emitEvent({
      kind: "position-closed",
      symbol: position.symbol,
      side: position.side,
      pnl: roundMoney(pnl),
      roe: trade.roe,
      action,
    });
    void prices;
  }
}

export const accountStore = new AccountStore();
