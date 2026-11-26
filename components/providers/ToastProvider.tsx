"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertTriangle, CheckCircle2, Info, X, Zap } from "lucide-react";
import { SYMBOL_META } from "@/lib/constants";
import { accountStore } from "@/lib/engine/store";
import { fmtPct, fmtUsdt, uid } from "@/lib/utils";
import { useMarketPrices } from "./MarketProvider";

type ToastKind = "success" | "error" | "info" | "liquidation";

type ToastItem = { id: string; message: string; kind: ToastKind };

type ToastApi = { push: (message: string, kind?: ToastKind) => void };

const ToastContext = createContext<ToastApi | null>(null);

const ICONS: Record<ToastKind, ReactNode> = {
  success: <CheckCircle2 className="h-4 w-4 text-up" />,
  error: <AlertTriangle className="h-4 w-4 text-down" />,
  info: <Info className="h-4 w-4 text-brand" />,
  liquidation: <Zap className="h-4 w-4 text-down" />,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const push = useCallback(
    (message: string, kind: ToastKind = "info") => {
      const id = uid("toast");
      setToasts((prev) => [...prev.slice(-3), { id, message, kind }]);
      const timer = setTimeout(() => dismiss(id), 4600);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  useEffect(() => {
    const unsubscribe = accountStore.onEvent((event) => {
      const base = SYMBOL_META[event.symbol].base;
      if (event.kind === "order-filled") {
        push(
          `${base} ${event.side === "LONG" ? "롱" : "숏"} ${event.qty} 체결 @ ${event.price.toLocaleString("en-US")}`,
          "success",
        );
      } else if (event.kind === "liquidated") {
        push(`${base} ${event.side === "LONG" ? "롱" : "숏"} 강제청산 · ${fmtUsdt(event.pnl)} USDT`, "liquidation");
      } else if (event.kind === "position-closed") {
        push(
          `${base} ${event.action === "TP" ? "익절" : event.action === "SL" ? "손절" : "종료"} · ${fmtUsdt(event.pnl)} USDT (${fmtPct(event.roe)})`,
          event.pnl >= 0 ? "success" : "error",
        );
      } else if (event.kind === "funding") {
        push(
          `${base} 펀딩 ${event.amount >= 0 ? "수령" : "지불"} ${fmtUsdt(Math.abs(event.amount))} USDT`,
          "info",
        );
      }
    });
    const timersMap = timers.current;
    return () => {
      unsubscribe();
      for (const timer of timersMap.values()) clearTimeout(timer);
      timersMap.clear();
    };
  }, [push]);

  const api = useMemo<ToastApi>(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[80] flex flex-col items-center gap-2 px-4 sm:left-6 sm:right-auto sm:items-start sm:px-0">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto flex w-full max-w-sm animate-fade-up items-start gap-2.5 rounded-lg border border-line bg-panel2/95 px-3.5 py-3 text-sm text-txt shadow-xl backdrop-blur"
          >
            <span className="mt-0.5 shrink-0">{ICONS[toast.kind]}</span>
            <p className="min-w-0 flex-1 leading-snug">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="shrink-0 text-muted transition-colors hover:text-txt"
              aria-label="알림 닫기"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}

/** 시세를 받아 모의 계좌 엔진을 주기적으로 돌린다. */
export function AccountEngine() {
  const { prices } = useMarketPrices();
  const pricesRef = useRef(prices);
  pricesRef.current = prices;
  useEffect(() => {
    accountStore.hydrate();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const snapshot = pricesRef.current;
      if (!snapshot.BTCUSDT.last && !snapshot.ETHUSDT.last) return;
      accountStore.tick(snapshot);
    }, 700);
    return () => clearInterval(timer);
  }, []);

  return null;
}
