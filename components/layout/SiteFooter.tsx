import Link from "next/link";
import { CandlestickChart, MessageCircle, ShieldAlert } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="mt-10 border-t border-line bg-panel/40">
      <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6">
        <div className="grid gap-8 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded bg-brand text-bg">
                <CandlestickChart className="h-4 w-4" strokeWidth={2.5} />
              </span>
              <span className="text-sm font-bold text-txt">롱숏톡 (LongShortTalk)</span>
            </div>
            <p className="mt-3 max-w-sm text-[12px] leading-relaxed text-muted">
              비트코인·이더리움 무기한 선물을 실시간 시세로 연습하는 모의투자 터미널입니다. 실제
              주문·입출금은 일어나지 않으며, 어떤 경우에도 투자 권유가 아닙니다.
            </p>
            <div className="mt-3 flex items-center gap-1.5 rounded-md border border-line bg-panel2 px-2.5 py-2 text-[11px] text-muted">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-brand" />
              <span>모든 잔고는 가상의 USDT이며 실제 자산이 아닙니다.</span>
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Trade</p>
            <ul className="mt-3 space-y-2 text-[13px] text-muted">
              <li>
                <Link href="/" className="hover:text-txt">
                  BTC 선물 모의거래
                </Link>
              </li>
              <li>
                <Link href="/" className="hover:text-txt">
                  ETH 선물 모의거래
                </Link>
              </li>
              <li>
                <Link href="/guide#calculator" className="hover:text-txt">
                  청산가 계산기
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Community</p>
            <ul className="mt-3 space-y-2 text-[13px] text-muted">
              <li>
                <Link href="/community" className="hover:text-txt">
                  포지션 인증
                </Link>
              </li>
              <li>
                <Link href="/community" className="hover:text-txt">
                  매매 전략
                </Link>
              </li>
              <li>
                <Link href="/ranking" className="hover:text-txt">
                  수익률 랭킹
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Learn</p>
            <ul className="mt-3 space-y-2 text-[13px] text-muted">
              <li>
                <Link href="/guide" className="hover:text-txt">
                  선물 거래 가이드
                </Link>
              </li>
              <li>
                <Link href="/guide#funding" className="hover:text-txt">
                  펀딩비란?
                </Link>
              </li>
              <li>
                <Link href="/guide#liquidation" className="hover:text-txt">
                  청산 이해하기
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-line pt-5 text-[11px] text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} LongShortTalk. 모의투자 · 교육 목적 서비스.</p>
          <p className="flex items-center gap-1.5">
            <MessageCircle className="h-3.5 w-3.5" />
            시세: Binance Futures / OKX (자동 전환) · 데모 폴백 지원
          </p>
        </div>
      </div>
    </footer>
  );
}
