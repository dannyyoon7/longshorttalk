import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, Calculator, Coins, Info, ShieldAlert, Timer } from "lucide-react";
import { LiquidationCalculator } from "@/components/guide/LiquidationCalculator";
import { AdSlot } from "@/components/ads/AdSlot";
import { AD_SLOTS } from "@/lib/constants";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://longshorttalk.vercel.app";

export const metadata: Metadata = {
  title: "선물 가이드 & 청산가 계산기 — 레버리지·교차/격리·펀딩비",
  description:
    "코인 선물 초보를 위한 가이드. 레버리지와 청산가 공식, 교차 vs 격리 차이, 펀딩비 정산 방식, 수수료 구조를 표와 예시로 정리했습니다. 청산가 계산기로 내 포지션의 청산 거리를 바로 확인하세요.",
  keywords: [
    "선물 가이드",
    "청산가 계산기",
    "레버리지 계산",
    "교차 격리 차이",
    "펀딩비 계산",
    "코인 선물 수수료",
    "롱숏톡",
  ],
  alternates: { canonical: "/guide" },
  openGraph: {
    title: "선물 가이드 & 청산가 계산기 | 롱숏톡",
    description:
      "레버리지·교차/격리·펀딩비·청산가 공식을 한 번에. 인터랙티브 청산가 계산기 포함.",
    url: "/guide",
  },
};

const FAQ = [
  {
    q: "코인 선물 모의투자로 실제로 배울 수 있나요?",
    a: "네. 롱숏톡은 바이낸스 실시간 시세와 동일한 마크가격 기준으로 주문·수수료·펀딩·청산을 계산합니다. 실제 자금은 오가지 않지만, 레버리지와 청산 거리를 몸으로 익히기에는 충분합니다.",
  },
  {
    q: "레버리지는 몇 배부터 시작하는 게 좋나요?",
    a: "일반적으로 1~5배에서 시작하는 것을 권합니다. 20배 롱은 진입가 대비 약 -4.6% 하락에서 청산되고, 125배는 -0.4% 수준의 작은 움직임에도 청산됩니다. 변동성이 큰 코인에서는 낮은 레버리지가 생존에 유리합니다.",
  },
  {
    q: "교차(Cross)와 격리(Isolated)는 무엇이 다른가요?",
    a: "격리는 해당 포지션에 넣은 증거금만 손실 위험에 노출되므로 최대 손실이 증거금으로 제한됩니다. 교차는 지갑 잔고 전체가 담보가 되어 청산가는 멀어지지만, 손실이 계좌 전체로 번질 수 있습니다.",
  },
  {
    q: "펀딩비는 언제, 어떻게 정산되나요?",
    a: "무기한 선물은 8시간마다(UTC 00:00·08:00·16:00) 펀딩비를 정산합니다. 펀딩비가 플러스면 롱이 숏에게, 마이너스면 숏이 롱에게 지급합니다. 포지션 규모에 비례하므로 장기 보유 시 비용을 확인해야 합니다.",
  },
  {
    q: "청산가는 어떻게 계산되나요?",
    a: "격리 롱 기준 청산가 ≈ 진입가 × (1 − 1/레버리지 + 유지증거금률)입니다. 예를 들어 20배 롱, 유지증거금률 0.4%라면 진입가의 약 95.4%에서 청산됩니다. 계산기에서 증거금·레버리지를 바꿔 직접 확인할 수 있습니다.",
  },
  {
    q: "TP와 SL은 꼭 걸어야 하나요?",
    a: "의무는 아니지만 강력히 권합니다. TP(익절)와 SL(손절)을 미리 걸면 감정적인 판단을 줄이고 손실 한도를 정할 수 있습니다. 롱숏톡에서는 주문 시 TP/SL을 동시에 설정할 수 있습니다.",
  },
];

export default function GuidePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: "코인 선물 모의투자 가이드 — 레버리지·교차/격리·펀딩비·청산가",
        description:
          "코인 선물의 레버리지, 교차/격리, 펀딩비, 청산가 계산 공식을 정리한 초보자 가이드.",
        inLanguage: "ko",
        mainEntityOfPage: `${SITE_URL}/guide`,
        author: { "@type": "Organization", name: "롱숏톡" },
        publisher: { "@type": "Organization", name: "롱숏톡" },
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQ.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "롱숏톡", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "선물 가이드", item: `${SITE_URL}/guide` },
        ],
      },
    ],
  };

  return (
    <div className="mx-auto max-w-[980px] px-3 py-5 sm:px-5">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav className="mb-3 flex items-center gap-1 text-[10px] text-muted">
        <Link href="/" className="hover:text-txt">
          롱숏톡
        </Link>
        <span>›</span>
        <span className="text-txt">선물 가이드</span>
      </nav>

      <header>
        <span className="rounded border border-brand/30 bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand">
          초보자 가이드
        </span>
        <h1 className="mt-2 text-[22px] font-bold leading-tight tracking-tight text-txt sm:text-[26px]">
          코인 선물 모의투자 가이드
          <span className="mt-1 block text-[13px] font-normal text-muted sm:text-[14px]">
            레버리지 · 교차/격리 · 펀딩비 · 청산가 계산까지 한 번에
          </span>
        </h1>
        <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
          비트코인·이더리움 무기한 선물은 현물과 달리 레버리지를 쓰고, 8시간마다 펀딩비가 정산되며,
          유지증거금을 유지하지 못하면 강제청산됩니다. 이 가이드는 그 세 가지를 실제 숫자로 이해할 수
          있게 정리했습니다. 읽고 나면 아래 계산기에서 내 포지션의 청산 거리를 직접 확인해 보세요.
        </p>
      </header>

      <nav className="mt-4 flex flex-wrap gap-1.5 border-y border-line py-2.5 text-[11px]">
        {[
          { href: "#leverage", label: "레버리지" },
          { href: "#mode", label: "교차 vs 격리" },
          { href: "#fee", label: "수수료" },
          { href: "#funding", label: "펀딩비" },
          { href: "#liquidation", label: "청산가 공식" },
          { href: "#calculator", label: "계산기" },
          { href: "#risk", label: "리스크 관리" },
          { href: "#faq", label: "FAQ" },
        ].map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="rounded-full border border-line px-2.5 py-1 text-muted transition-colors hover:border-brand/40 hover:text-txt"
          >
            {item.label}
          </a>
        ))}
      </nav>

      <article className="mt-5 space-y-7 text-[12.5px] leading-relaxed text-muted">
        <section id="leverage" className="scroll-mt-20">
          <h2 className="flex items-center gap-1.5 text-[16px] font-bold text-txt">
            <BookOpen className="h-4 w-4 text-brand" /> 1. 레버리지: 수익도 손실도 배수로
          </h2>
          <p className="mt-2">
            레버리지는 적은 증거금으로 더 큰 포지션을 만드는 기능입니다. 1,000 USDT로 20배 레버리지를
            쓰면 20,000 USDT 규모의 포지션을 보유합니다. 가격이 1% 오르면 포지션 이익은 200 USDT로
            증거금 대비 <strong className="text-txt">+20%</strong>, 반대로 1% 내리면 -20%입니다.
          </p>
          <div className="mt-3 overflow-hidden rounded-lg border border-line">
            <table className="w-full text-left text-[11.5px]">
              <thead className="bg-panel2 text-[10px] text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">레버리지</th>
                  <th className="px-3 py-2 text-right font-medium">필요 증거금 (1만 USDT 포지션)</th>
                  <th className="px-3 py-2 text-right font-medium">격리 청산 거리</th>
                </tr>
              </thead>
              <tbody>
                {[2, 5, 10, 20, 50, 100, 125].map((lev) => (
                  <tr key={lev} className="border-t border-line/60">
                    <td className="px-3 py-1.5 text-txt">{lev}x</td>
                    <td className="tnum px-3 py-1.5 text-right">
                      {(10000 / lev).toLocaleString("en-US")} USDT
                    </td>
                    <td className="tnum px-3 py-1.5 text-right text-down">
                      -{((1 / lev - 0.004) * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-muted/80">
            * 유지증거금률 0.4% 기준 근사치. 레버리지가 높을수록 청산까지의 거리가 급격히 짧아집니다.
          </p>
        </section>

        <section id="mode" className="scroll-mt-20">
          <h2 className="text-[16px] font-bold text-txt">2. 교차(Cross) vs 격리(Isolated)</h2>
          <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-line bg-panel p-3.5">
              <p className="text-[12px] font-semibold text-txt">격리 (Isolated)</p>
              <p className="mt-1 text-[11.5px]">
                포지션에 넣은 증거금만 위험에 노출됩니다. 최대 손실이 그 증거금으로 제한되지만,
                청산가는 진입가에 가깝습니다.
              </p>
              <p className="mt-1.5 text-[10px] text-up">✔ 손실 한도 명확 · 초보자 권장</p>
            </div>
            <div className="rounded-lg border border-line bg-panel p-3.5">
              <p className="text-[12px] font-semibold text-txt">교차 (Cross)</p>
              <p className="mt-1 text-[11.5px]">
                지갑 잔고 전체가 담보가 됩니다. 청산가는 멀어지지만, 손실이 계좌 전체로 번질 수
                있습니다.
              </p>
              <p className="mt-1.5 text-[10px] text-down">⚠ 계좌 전액 손실 가능 · 고급자용</p>
            </div>
          </div>
          <div className="mt-2.5 overflow-hidden rounded-lg border border-line">
            <table className="w-full text-left text-[11.5px]">
              <thead className="bg-panel2 text-[10px] text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">구분</th>
                  <th className="px-3 py-2 font-medium">격리</th>
                  <th className="px-3 py-2 font-medium">교차</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["담보 범위", "포지션 증거금", "지갑 잔고 전체"],
                  ["청산가", "진입가에 가까움", "상대적으로 멀음"],
                  ["최대 손실", "증거금 한도", "계좌 전체"],
                  ["추천 대상", "초보·단기 매매", "숙련·포트폴리오 헤지"],
                ].map((row) => (
                  <tr key={row[0]} className="border-t border-line/60">
                    <td className="px-3 py-1.5 text-txt">{row[0]}</td>
                    <td className="px-3 py-1.5">{row[1]}</td>
                    <td className="px-3 py-1.5">{row[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="fee" className="scroll-mt-20">
          <h2 className="flex items-center gap-1.5 text-[16px] font-bold text-txt">
            <Coins className="h-4 w-4 text-brand" /> 3. 수수료 구조
          </h2>
          <p className="mt-2">
            USDT-M 선물의 기본 수수료는 시장가(Taker) 0.05%, 지정가(Maker) 0.02%입니다. 주문 금액에
            비례하며, 진입과 종료 때 각각 발생합니다.
          </p>
          <div className="mt-2 rounded-lg border border-line bg-bg p-3 font-mono text-[11px] text-txt/90">
            <p>수수료 = 포지션 규모 × 수수료율</p>
            <p className="mt-1 text-muted">
              20배 롱, 증거금 1,000 USDT(규모 20,000) → 시장가 진입 10 USDT + 종료 10 USDT = 총 20 USDT
            </p>
          </div>
          <p className="mt-2 text-[11px]">
            수수료를 아끼려면 지정가(Maker) 주문을 활용하지만, 체결되지 않을 위험이 있습니다.
          </p>
        </section>

        <section id="funding" className="scroll-mt-20">
          <h2 className="flex items-center gap-1.5 text-[16px] font-bold text-txt">
            <Timer className="h-4 w-4 text-brand" /> 4. 펀딩비: 8시간마다 정산
          </h2>
          <p className="mt-2">
            무기한 선물은 만기가 없어서 현물 가격과의 괴리를 펀딩비로 맞춥니다. 정산 시각은 UTC
            00:00·08:00·16:00(한국시간 09:00·17:00·01:00)입니다. 펀딩비가 <strong className="text-txt">+</strong>면
            롱이 숏에게, <strong className="text-txt">-</strong>면 숏이 롱에게 지급합니다.
          </p>
          <div className="mt-2 rounded-lg border border-line bg-bg p-3 font-mono text-[11px] text-txt/90">
            <p>펀딩 정산액 = 마크가격 × 수량 × 펀딩비율</p>
            <p className="mt-1 text-muted">
              예: 20,000 USDT 롱, 펀딩 +0.0100% → 2 USDT 지불 (8시간마다)
            </p>
          </div>
          <p className="mt-2 text-[11px]">
            단기 스캘핑에는 영향이 작지만, 며칠 이상 보유하면 펀딩비가 수익률을 크게 바꿀 수 있습니다.
            거래 화면 상단에서 다음 펀딩까지 남은 시간과 현재 펀딩비를 확인하세요.
          </p>
        </section>

        <section id="liquidation" className="scroll-mt-20">
          <h2 className="flex items-center gap-1.5 text-[16px] font-bold text-txt">
            <ShieldAlert className="h-4 w-4 text-down" /> 5. 청산가 계산 공식
          </h2>
          <p className="mt-2">격리 모드 기준으로 청산가는 다음처럼 계산됩니다.</p>
          <div className="mt-2 space-y-1.5 rounded-lg border border-line bg-bg p-3 font-mono text-[11px] text-txt/90">
            <p>롱 청산가 ≈ 진입가 × (1 − 1/레버리지 + 유지증거금률)</p>
            <p>숏 청산가 ≈ 진입가 × (1 + 1/레버리지 − 유지증거금률)</p>
            <p className="pt-1 text-muted">유지증거금률: BTC/ETH 1단계 0.4% (모의 엔진 기준)</p>
          </div>
          <p className="mt-2">
            예를 들어 BTC를 20배 롱으로 진입하고 유지증거금률이 0.4%라면, 청산가는 진입가의 약{" "}
            <strong className="text-txt">95.6%</strong>입니다. 진입가가 60,000 USDT라면 약 57,360
            USDT에서 청산됩니다. 125배라면 청산 거리가 1%도 되지 않습니다.
          </p>
          <p className="mt-2 text-[11px]">
            교차 모드에서는 지갑 잔고가 담보가 되므로 청산가가 훨씬 멀어집니다. 다만 다른 포지션의
            손실까지 합산되면 예상보다 빨리 청산될 수 있습니다.
          </p>
        </section>

        <LiquidationCalculator />

        <section id="risk" className="scroll-mt-20">
          <h2 className="text-[16px] font-bold text-txt">6. 리스크 관리 체크리스트</h2>
          <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {[
              "진입 전 청산가를 먼저 확인한다",
              "한 번에 계좌의 10% 이상을 걸지 않는다",
              "레버리지는 3~5배에서 시작한다",
              "TP/SL을 주문과 동시에 설정한다",
              "펀딩비·수수료를 수익 계산에 포함한다",
              "연속 손실 시 하루 거래를 멈춘다",
              "교차 모드는 계좌 전체 손실을 기억한다",
              "모의투자로 먼저 전략을 검증한다",
            ].map((item) => (
              <li key={item} className="flex items-start gap-1.5 rounded border border-line/60 bg-panel px-2.5 py-1.5 text-[11.5px]">
                <span className="text-up">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section id="faq" className="scroll-mt-20">
          <h2 className="text-[16px] font-bold text-txt">7. 자주 묻는 질문 (FAQ)</h2>
          <div className="mt-2 space-y-2">
            {FAQ.map((item) => (
              <details key={item.q} className="group rounded-lg border border-line bg-panel p-3">
                <summary className="flex cursor-pointer items-center justify-between gap-2 text-[12px] font-medium text-txt">
                  {item.q}
                  <span className="text-muted transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-2 text-[11.5px] leading-relaxed text-muted">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-brand/25 bg-brand/[0.05] p-4">
          <h2 className="flex items-center gap-1.5 text-[14px] font-bold text-txt">
            <Calculator className="h-4 w-4 text-brand" /> 이제 직접 연습해 보세요
          </h2>
          <p className="mt-1.5 text-[11.5px]">
            가입 없이 10,000 USDT 모의 시드로 BTC·ETH 선물을 거래할 수 있습니다. 실시간 시세, 청산,
            펀딩까지 실제와 동일하게 동작합니다.
          </p>
          <Link
            href="/"
            className="mt-2.5 inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-[11px] font-semibold text-bg hover:bg-brand/90"
          >
            모의투자 시작하기 <ArrowRight className="h-3 w-3" />
          </Link>
        </section>

        <p className="flex items-start gap-1.5 rounded border border-line/60 bg-panel/50 px-3 py-2 text-[10px] leading-relaxed text-muted/70">
          <Info className="mt-0.5 h-3 w-3 shrink-0" />
          본 가이드는 교육 목적의 정보이며 투자 권유가 아닙니다. 선물 거래는 원금 전액을 잃을 수 있는
          고위험 상품입니다. 실제 투자 결정과 책임은 본인에게 있습니다.
        </p>

        <AdSlot slot={AD_SLOTS.guide} format="banner" label="광고 영역 (가이드 하단)" />
      </article>
    </div>
  );
}
