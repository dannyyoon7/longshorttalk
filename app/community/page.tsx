import type { Metadata } from "next";
import Link from "next/link";
import { Flame, Hash, Trophy } from "lucide-react";
import { CommunityBoard } from "@/components/community/CommunityBoard";
import { AdSlot } from "@/components/ads/AdSlot";
import { AD_SLOTS } from "@/lib/constants";
import { DEMO_TRADERS } from "@/lib/local/ranking";
import { fmtPct } from "@/lib/utils";

export const metadata: Metadata = {
  title: "커뮤니티 — 포지션 인증 · 매매 전략",
  description:
    "코인 선물 모의투자 커뮤니티. BTC·ETH 포지션 인증, 매매 전략 공유, 초보 질문까지. 롱숏톡에서 실시간 채팅과 함께 트레이더들과 이야기하세요.",
  alternates: { canonical: "/community" },
  openGraph: {
    title: "롱숏톡 커뮤니티 — 포지션 인증 · 매매 전략",
    description: "BTC·ETH 선물 모의투자 포지션 인증과 전략 공유 커뮤니티.",
    url: "/community",
  },
};

const TOPICS = ["청산가", "레버리지", "교차격리", "펀딩비", "BTC롱", "ETH숏", "손절원칙", "스캘핑"];

export default function CommunityPage() {
  const top = [...DEMO_TRADERS].sort((a, b) => b.weekly - a.weekly).slice(0, 5);

  return (
    <div className="mx-auto max-w-[1240px] px-3 py-4 sm:px-5">
      <header className="mb-4">
        <h1 className="text-[18px] font-bold tracking-tight text-txt">커뮤니티</h1>
        <p className="mt-1 text-[12px] text-muted">
          포지션 인증부터 매매 전략, 초보 질문까지. 모의투자 기록을 남기고 다른 트레이더와 비교해
          보세요.
        </p>
        <p className="mt-1 text-[10px] text-muted/70">
          Supabase를 연결하기 전(데모 모드)에는 서비스 시연용 샘플 게시글이 함께 표시됩니다.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <CommunityBoard />

        <aside className="space-y-3">
          <section className="rounded-lg border border-line bg-panel p-3">
            <h2 className="flex items-center gap-1.5 text-[12px] font-semibold text-txt">
              <Flame className="h-3.5 w-3.5 text-brand" /> 이번 주 인기 트레이더
            </h2>
            <ul className="mt-2 space-y-1.5">
              {top.map((trader, index) => (
                <li key={trader.id} className="flex items-center gap-2 text-[11px]">
                  <span className="tnum w-4 text-muted">{index + 1}</span>
                  <span className="text-[13px]">{trader.emoji}</span>
                  <span className="min-w-0 flex-1 truncate text-txt">{trader.nickname}</span>
                  <span className={trader.weekly >= 0 ? "tnum text-up" : "tnum text-down"}>
                    {fmtPct(trader.weekly)}
                  </span>
                </li>
              ))}
            </ul>
            <Link href="/ranking" className="mt-2.5 flex items-center gap-1 text-[10px] text-brand">
              <Trophy className="h-3 w-3" /> 전체 랭킹 보기
            </Link>
          </section>

          <section className="rounded-lg border border-line bg-panel p-3">
            <h2 className="flex items-center gap-1.5 text-[12px] font-semibold text-txt">
              <Hash className="h-3.5 w-3.5 text-brand" /> 인기 토픽
            </h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {TOPICS.map((topic) => (
                <span
                  key={topic}
                  className="rounded-full border border-line bg-panel2 px-2 py-0.5 text-[10px] text-muted"
                >
                  #{topic}
                </span>
              ))}
            </div>
          </section>

          <div className="rounded-lg border border-line bg-panel p-3 text-[10px] leading-relaxed text-muted">
            <p className="mb-1 text-[11px] font-semibold text-txt">커뮤니티 규칙</p>
            <p>· 모의투자 기록·전략 공유는 자유롭게, 리딩·투자 권유는 금지합니다.</p>
            <p>· 욕설·도배·타인 비방은 삭제될 수 있습니다.</p>
            <p>· 모든 글은 작성자의 개인 의견이며 투자 판단의 근거가 될 수 없습니다.</p>
          </div>

          <AdSlot slot={AD_SLOTS.community} format="box" label="광고 영역 (커뮤니티 사이드)" />
        </aside>
      </div>

      <section className="mt-6 rounded-lg border border-line bg-panel p-4">
        <h2 className="text-[13px] font-semibold text-txt">포지션 인증글이 유용한 이유</h2>
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted">
          진입가·청산가·레버리지·수익률을 함께 남기면, 결과만 보는 것보다 어떤 리스크를 감수했는지
          알 수 있습니다. 롱숏톡의 포지션 인증은 거래 화면에서 <strong className="text-txt">인증글</strong>{" "}
          버튼 한 번으로 작성할 수 있고, 내 포지션 뱃지가 자동으로 붙습니다. 다만 모든 글은 모의투자
          기록이며 실제 투자 권유가 아닙니다.
        </p>
      </section>
    </div>
  );
}
