"use client";

import { useState } from "react";
import { BarChart3, BookOpen, CandlestickChart, MessageCircle, Wallet } from "lucide-react";
import { MarketBar } from "./MarketBar";
import { ChartPanel } from "./ChartPanel";
import { OrderBookPanel } from "./OrderBookPanel";
import { OrderPanel } from "./OrderPanel";
import { PositionsPanel } from "./PositionsPanel";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { cn } from "@/lib/utils";

type MobileTab = "chart" | "book" | "order" | "chat";

const TABS: { key: MobileTab; label: string; icon: React.ReactNode }[] = [
  { key: "chart", label: "차트", icon: <CandlestickChart className="h-3.5 w-3.5" /> },
  { key: "book", label: "호가", icon: <BarChart3 className="h-3.5 w-3.5" /> },
  { key: "order", label: "주문", icon: <Wallet className="h-3.5 w-3.5" /> },
  { key: "chat", label: "채팅", icon: <MessageCircle className="h-3.5 w-3.5" /> },
];

export function TradeTerminal() {
  const [mobileTab, setMobileTab] = useState<MobileTab>("chart");
  const [preset, setPreset] = useState<{ price: number; ts: number } | null>(null);

  return (
    <div className="space-y-2">
      <div className="flex gap-1 overflow-x-auto rounded-lg border border-line bg-panel p-1 lg:hidden">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setMobileTab(tab.key)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1 rounded px-2 py-1.5 text-[11px] font-medium transition-colors",
              mobileTab === tab.key ? "bg-panel3 text-brand" : "text-muted",
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <MarketBar />

      <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_250px_300px_330px]">
        <div className={cn("min-w-0", mobileTab !== "chart" && "hidden lg:block")}>
          <ChartPanel />
        </div>

        <div className={cn(mobileTab !== "book" && "hidden lg:block")}>
          <OrderBookPanel onPriceSelect={(price) => setPreset({ price, ts: Date.now() })} />
        </div>

        <div className={cn(mobileTab !== "order" && "hidden lg:block")}>
          <OrderPanel preset={preset} />
        </div>

        <div className={cn("xl:row-span-2", mobileTab !== "chat" && "hidden lg:block")}>
          <ChatPanel />
        </div>

        <div className="xl:col-span-3">
          <PositionsPanel />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-panel/60 px-3 py-2 text-[10px] text-muted">
        <span className="flex items-center gap-1.5">
          <BookOpen className="h-3 w-3 text-brand" />
          처음이라면 <span className="text-txt">선물 가이드</span>에서 레버리지·청산가 공식을 먼저 확인하세요.
        </span>
        <span className="tnum">수수료 Taker 0.05% / Maker 0.02% · 펀딩 8시간</span>
      </div>
    </div>
  );
}
