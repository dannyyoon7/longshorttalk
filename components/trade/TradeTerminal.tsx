"use client";

import { useState } from "react";
import { BarChart3, BookOpen, CandlestickChart, MessageCircle } from "lucide-react";
import { MarketBar } from "./MarketBar";
import { ChartPanel } from "./ChartPanel";
import { CompactBook } from "./CompactBook";
import { OrderBookPanel } from "./OrderBookPanel";
import { OrderPanel } from "./OrderPanel";
import { PositionsPanel } from "./PositionsPanel";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { cn } from "@/lib/utils";

type MobileTab = "trade" | "book" | "chat";

const TABS: { key: MobileTab; label: string; icon: React.ReactNode }[] = [
  { key: "trade", label: "거래", icon: <CandlestickChart className="h-3.5 w-3.5" /> },
  { key: "book", label: "호가", icon: <BarChart3 className="h-3.5 w-3.5" /> },
  { key: "chat", label: "채팅", icon: <MessageCircle className="h-3.5 w-3.5" /> },
];

function TerminalNote() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-panel/60 px-3 py-2 text-[10px] text-muted">
      <span className="flex items-center gap-1.5">
        <BookOpen className="h-3 w-3 text-brand" />
        처음이라면 <span className="text-txt">선물 가이드</span>에서 레버리지·청산가 공식을 먼저 확인하세요.
      </span>
      <span className="tnum">수수료 Taker 0.05% / Maker 0.02% · 펀딩 8시간</span>
    </div>
  );
}

export function TradeTerminal() {
  // SSR/첫 렌더는 데스크톱(프로 트레이딩) 레이아웃으로 그리고, 마운트 후 실제 뷰포트에 맞춘다.
  const isDesktop = useMediaQuery("(min-width: 1024px)", true);
  const [mobileTab, setMobileTab] = useState<MobileTab>("trade");
  const [preset, setPreset] = useState<{ price: number; ts: number } | null>(null);

  const selectPrice = (price: number) => setPreset({ price, ts: Date.now() });

  if (isDesktop) {
    // ── PC: 기존 3열(차트 | 호가 | 주문) + 채팅 + 포지션 프로 레이아웃 유지 ──
    return (
      <div className="space-y-2">
        <MarketBar />

        <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_250px_300px_330px]">
          <div className="min-w-0">
            <ChartPanel />
          </div>

          <div>
            <OrderBookPanel onPriceSelect={selectPrice} />
          </div>

          <div>
            <OrderPanel preset={preset} />
          </div>

          <div className="xl:row-span-2">
            <ChatPanel />
          </div>

          <div className="xl:col-span-3">
            <PositionsPanel />
          </div>
        </div>

        <TerminalNote />
      </div>
    );
  }

  // ── 모바일: 차트를 위에 고정하고 바로 아래에서 주문까지 한 흐름으로 ──
  return (
    <div className="space-y-2">
      <div className="flex gap-1 rounded-lg border border-line bg-panel p-1">
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

      <div className={cn("space-y-2", mobileTab !== "trade" && "hidden")}>
        {/* 스크롤해도 차트가 상단에 고정돼 시세를 보며 주문할 수 있다 */}
        <div className="sticky top-14 z-30 -mx-2.5 bg-bg/95 px-2.5 py-1 backdrop-blur sm:-mx-4 sm:px-4">
          <ChartPanel compact />
        </div>

        <CompactBook onPriceSelect={selectPrice} onOpenBook={() => setMobileTab("book")} />

        <OrderPanel preset={preset} compact />

        <PositionsPanel />
      </div>

      <div className={cn(mobileTab !== "book" && "hidden")}>
        <OrderBookPanel
          onPriceSelect={(price) => {
            selectPrice(price);
            setMobileTab("trade");
          }}
        />
      </div>

      <div className={cn(mobileTab !== "chat" && "hidden")}>
        <ChatPanel />
      </div>

      <TerminalNote />
    </div>
  );
}
