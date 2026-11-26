import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Trophy } from "lucide-react";
import { RankingBoard } from "@/components/ranking/RankingBoard";
import { AdSlot } from "@/components/ads/AdSlot";
import { AD_SLOTS } from "@/lib/constants";

export const metadata: Metadata = {
  title: "수익률 랭킹 — 주간 · 전체 TOP 트레이더",
  description:
    "롱숏톡 모의투자 수익률 랭킹. 주간·전체 수익률 TOP 트레이더와 승률, 거래 횟수를 비교하고 내 순위를 확인하세요.",
  alternates: { canonical: "/ranking" },
  openGraph: {
    title: "롱숏톡 수익률 랭킹",
    description: "주간·전체 모의투자 수익률 TOP 트레이더 보드.",
    url: "/ranking",
  },
};

export default function RankingPage() {
  return (
    <div className="mx-auto max-w-[1100px] px-3 py-4 sm:px-5">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-1.5 text-[18px] font-bold tracking-tight text-txt">
            <Trophy className="h-4.5 w-4.5 text-brand" /> 수익률 랭킹
          </h1>
          <p className="mt-1 text-[12px] text-muted">
            주간·전체 수익률로 트레이더를 비교합니다. 모든 기록은 모의투자 기준입니다.
          </p>
          <p className="mt-1 text-[10px] text-muted/70">
            상위 트레이더는 서비스 시연을 위한 샘플 데이터이며, 내 기록은 이 브라우저의 모의 계좌
            기준입니다.
          </p>
        </div>
        <Link
          href="/"
          className="flex items-center gap-1 rounded-md border border-line px-2.5 py-1.5 text-[11px] text-txt hover:border-brand/40"
        >
          거래 화면으로 <ArrowRight className="h-3 w-3" />
        </Link>
      </header>

      <RankingBoard />

      <div className="mt-5 grid gap-3 lg:grid-cols-[1.6fr_1fr]">
        <section className="rounded-lg border border-line bg-panel p-4">
          <h2 className="text-[13px] font-semibold text-txt">랭킹은 어떻게 계산되나요?</h2>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted">
            수익률은 모의 계좌의 총 자산(지갑 잔고 + 미실현 손익)과 누적 입금액을 비교해 계산합니다.
            시드 리필을 받으면 입금액이 함께 늘어나 수익률이 왜곡되지 않습니다. 승률은 종료된
            포지션(수동 종료·TP·SL·강제청산) 중 이익으로 끝난 비율입니다. 레버리지가 높다고 순위가
            높아지는 구조가 아니라, 위험을 관리하면서 꾸준히 수익을 낸 기록이 위로 올라갑니다.
          </p>
        </section>
        <AdSlot slot={AD_SLOTS.guide} format="banner" label="광고 영역 (랭킹 하단)" />
      </div>
    </div>
  );
}
