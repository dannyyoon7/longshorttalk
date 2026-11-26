import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Calculator,
  CandlestickChart,
  MessagesSquare,
  ShieldCheck,
  Trophy,
  Zap,
} from "lucide-react";
import { TradeTerminal } from "@/components/trade/TradeTerminal";
import { AdSlot } from "@/components/ads/AdSlot";
import { AD_SLOTS } from "@/lib/constants";

export const metadata: Metadata = {
  title: "롱숏톡 — 비트코인·이더리움 선물 모의투자 터미널",
  description:
    "바이낸스 실시간 시세로 BTC·ETH 무기한 선물을 모의매매. 최대 125배 레버리지, 교차/격리, TP/SL, 자동 청산, 실시간 호가와 청산가 계산까지. 가입 없이 10,000 USDT로 바로 체험.",
  alternates: { canonical: "/" },
};

const FEATURES = [
  {
    icon: <Activity className="h-4 w-4" />,
    title: "실시간 바이낸스 선물 시세",
    body: "aggTrade·마크가격·10단 호가·1초 펀딩비를 웹소켓으로 수신합니다. 연결이 끊기면 자동 재연결하고, 바이낸스가 차단된 환경에서는 OKX 실시간 피드로 자동 전환됩니다.",
  },
  {
    icon: <Zap className="h-4 w-4" />,
    title: "실전형 주문 엔진",
    body: "교차/격리, BTC 1~125x·ETH 1~100x 레버리지, 시장가/지정가, TP/SL 동시 설정. 지정가는 현재가 도달 시 자동 체결되고, 마크가격이 청산가에 닿으면 강제청산됩니다.",
  },
  {
    icon: <Calculator className="h-4 w-4" />,
    title: "수수료·펀딩·청산가 계산",
    body: "Taker 0.05%·Maker 0.02% 수수료, 8시간 펀딩 정산, 유지증거금 0.4% 기준 청산가를 실시간으로 계산합니다. 부분 종료와 거래내역까지 실제 거래소와 같은 흐름입니다.",
  },
  {
    icon: <MessagesSquare className="h-4 w-4" />,
    title: "포지션 뱃지 실시간 채팅",
    body: "내 포지션(예: BTC 20x 롱 +18.4%)이 채팅 뱃지로 자동 표시됩니다. 커뮤니티에서 포지션을 인증하고, 수익률 랭킹에서 다른 트레이더와 비교해 보세요.",
  },
];

export default function HomePage() {
  return (
    <div className="mx-auto max-w-[1600px] px-2.5 py-3 sm:px-4">
      <div className="mb-2.5 flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="flex items-center gap-1 rounded border border-brand/30 bg-brand/10 px-1.5 py-0.5 text-[9px] font-semibold text-brand">
              <ShieldCheck className="h-2.5 w-2.5" /> 모의투자 · 실제 자금 없음
            </span>
            <span className="rounded border border-line px-1.5 py-0.5 text-[9px] text-muted">
              가입 없이 10,000 USDT
            </span>
            <span className="hidden rounded border border-line px-1.5 py-0.5 text-[9px] text-muted sm:block">
              BTC · ETH 무기한 선물
            </span>
          </div>
          <h1 className="mt-1.5 text-[15px] font-bold tracking-tight text-txt sm:text-[17px]">
            비트코인·이더리움 선물 모의투자 터미널
          </h1>
          <p className="mt-0.5 hidden text-[11px] text-muted sm:block">
            실시간 시세 · 레버리지 · 청산가 · 포지션 채팅까지, 실제 거래소처럼 연습하세요.
          </p>
        </div>
        <Link
          href="/guide"
          className="flex items-center gap-1 text-[11px] font-medium text-brand hover:text-brand/80"
        >
          선물 가이드 / 청산가 계산기 <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <TradeTerminal />

      <section className="mt-6 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {FEATURES.map((feature) => (
          <article key={feature.title} className="rounded-lg border border-line bg-panel p-3.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-panel3 text-brand">
              {feature.icon}
            </span>
            <h2 className="mt-2.5 text-[12.5px] font-semibold text-txt">{feature.title}</h2>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted">{feature.body}</p>
          </article>
        ))}
      </section>

      <div className="mt-6 grid gap-3 lg:grid-cols-[1.6fr_1fr]">
        <section className="rounded-lg border border-line bg-panel p-4 sm:p-5">
          <h2 className="text-[14px] font-bold text-txt">
            코인 선물, 처음이라면 이렇게 시작하세요
          </h2>
          <p className="mt-2 text-[12px] leading-relaxed text-muted">
            롱숏톡은 <strong className="font-semibold text-txt">비트코인(BTCUSDT)</strong>과{" "}
            <strong className="font-semibold text-txt">이더리움(ETHUSDT)</strong> 무기한 선물을 실제
            거래소와 동일한 방식으로 연습하는 모의투자 서비스입니다. 현물과 달리 선물은 레버리지를
            사용하고, 교차(Cross)와 격리(Isolated) 중 어떤 증거금 모드를 쓰느냐에 따라 청산가가
            달라집니다. 처음에는 3~5배 낮은 레버리지로 시작하고, 주문 전에 반드시 청산가와 손절 폭을
            먼저 계산하는 습관을 들이세요.
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-muted">
            주문 패널에서 시장가 또는 지정가를 선택하고, TP(익절)·SL(손절)을 함께 걸어두면 마크가격이
            도달할 때 자동으로 종료됩니다. 수수료는 Taker 0.05%, Maker 0.02%이며 8시간마다 펀딩비가
            정산됩니다. 모든 잔고는 가상의 USDT이므로 실제 자금이 오가지 않습니다.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/guide"
              className="flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-[11px] font-semibold text-bg hover:bg-brand/90"
            >
              <CandlestickChart className="h-3.5 w-3.5" /> 선물 기초 가이드
            </Link>
            <Link
              href="/ranking"
              className="flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-[11px] text-txt hover:border-brand/40"
            >
              <Trophy className="h-3.5 w-3.5 text-brand" /> 수익률 랭킹
            </Link>
            <Link
              href="/community"
              className="flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-[11px] text-txt hover:border-brand/40"
            >
              <MessagesSquare className="h-3.5 w-3.5 text-brand" /> 커뮤니티
            </Link>
          </div>
        </section>

        <AdSlot slot={AD_SLOTS.home} format="banner" className="h-full" label="광고 영역 (홈 하단)" />
      </div>

      <p className="mt-4 text-[10px] leading-relaxed text-muted/60">
        본 서비스는 학습·모의투자 목적이며 투자 자문이나 권유가 아닙니다. 선물 거래는 원금 전액을
        잃을 수 있는 고위험 상품입니다. 실거래 시에는 반드시 본인의 판단과 책임 아래 진행하세요.
      </p>
    </div>
  );
}
