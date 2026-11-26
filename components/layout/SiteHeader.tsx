"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CandlestickChart, Menu, ShieldCheck, Wallet, X } from "lucide-react";
import { equityOf } from "@/lib/engine/store";
import { useAccount } from "@/lib/engine/useAccount";
import { useProfile, profileStore } from "@/lib/profile";
import { useMarketPrices } from "@/components/providers/MarketProvider";
import { cn, fmtUsdt } from "@/lib/utils";

const NAV = [
  { href: "/", label: "거래소" },
  { href: "/community", label: "커뮤니티" },
  { href: "/ranking", label: "랭킹" },
  { href: "/guide", label: "선물 가이드" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const account = useAccount();
  const { prices } = useMarketPrices();
  const profile = useProfile();

  useEffect(() => {
    profileStore.hydrate();
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const equity = equityOf(account, prices);
  const roi = account.deposits > 0 ? ((equity - account.deposits) / account.deposits) * 100 : 0;

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-bg/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-3 px-3 sm:px-5">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand text-bg">
            <CandlestickChart className="h-5 w-5" strokeWidth={2.4} />
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-[15px] font-bold tracking-tight text-txt">롱숏톡</span>
            <span className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.18em] text-muted">
              LongShortTalk
            </span>
          </span>
        </Link>

        <span className="ml-1 hidden items-center gap-1 rounded border border-brand/30 bg-brand/10 px-1.5 py-0.5 text-[10px] font-semibold text-brand sm:flex">
          <ShieldCheck className="h-3 w-3" /> 모의투자
        </span>

        <nav className="ml-3 hidden items-center gap-1 md:flex">
          {NAV.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                  active ? "bg-panel2 text-txt" : "text-muted hover:bg-panel2 hover:text-txt",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden items-center gap-2 rounded-md border border-line bg-panel px-2.5 py-1.5 sm:flex">
            <Wallet className="h-3.5 w-3.5 text-muted" />
            <div className="leading-none">
              <p className="text-[10px] text-muted">내 자산 (모의)</p>
              <p className="tnum mt-0.5 text-[12px] font-semibold text-txt">
                {fmtUsdt(equity)} <span className="text-[10px] font-normal text-muted">USDT</span>
                <span className={cn("ml-1.5 text-[10px]", roi >= 0 ? "text-up" : "text-down")}>
                  {roi >= 0 ? "+" : ""}
                  {roi.toFixed(2)}%
                </span>
              </p>
            </div>
          </div>

          <Link
            href="/ranking"
            className="flex items-center gap-1.5 rounded-md border border-line bg-panel px-2 py-1.5 text-[12px] text-txt transition-colors hover:border-brand/40"
            title="내 닉네임 · 랭킹"
          >
            <span className="text-base leading-none">{profile.emoji}</span>
            <span className="hidden max-w-[86px] truncate sm:block">{profile.nickname}</span>
          </Link>

          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-line bg-panel text-muted md:hidden"
            aria-label="메뉴"
          >
            {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="border-t border-line bg-panel px-3 py-2 md:hidden">
          <div className="grid grid-cols-2 gap-2">
            {NAV.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm",
                    active ? "bg-panel3 text-txt" : "text-muted",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
          <p className="mt-2 px-1 text-[11px] text-muted">
            모의투자 서비스입니다. 실제 자금이 오가지 않습니다.
          </p>
        </nav>
      )}
    </header>
  );
}
