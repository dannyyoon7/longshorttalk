import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Providers } from "@/components/providers/Providers";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://longshorttalk.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "롱숏톡 — 비트코인·이더리움 선물 모의투자 & 실시간 채팅",
    template: "%s | 롱숏톡",
  },
  description:
    "바이낸스 실시간 시세로 BTC·ETH 무기한 선물을 모의매매. 레버리지·교차/격리·TP/SL·청산가 계산까지 실제 거래소처럼, 실시간 채팅과 수익률 랭킹, 커뮤니티까지 한 화면에서. 가입 없이 10,000 USDT로 바로 시작하세요.",
  keywords: [
    "코인 선물 모의투자",
    "비트코인 선물",
    "이더리움 선물",
    "롱숏톡",
    "가상화폐 모의매매",
    "청산가 계산기",
    "레버리지 거래",
    "펀딩비",
    "바이낸스 선물",
    "코인 커뮤니티",
  ],
  applicationName: "롱숏톡",
  authors: [{ name: "LongShortTalk" }],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "롱숏톡 (LongShortTalk)",
    title: "롱숏톡 — 비트코인·이더리움 선물 모의투자",
    description:
      "실시간 바이낸스 시세 기반 BTC/ETH 선물 모의투자 터미널. 레버리지·청산가·펀딩비까지 실제 거래소처럼, 실시간 채팅과 수익률 랭킹까지.",
    url: "/",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "롱숏톡 - 코인 선물 모의투자 터미널",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "롱숏톡 — 비트코인·이더리움 선물 모의투자",
    description:
      "실시간 시세로 BTC/ETH 선물 모의매매 + 실시간 채팅 + 수익률 랭킹. 가입 없이 10,000 USDT로 시작.",
    images: ["/og.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  category: "finance",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0B0E11",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="dark">
      <body className="min-h-screen bg-bg font-sans text-txt antialiased">
        <Providers>
          <div className="flex min-h-screen flex-col">
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <SiteFooter />
          </div>
        </Providers>
      </body>
    </html>
  );
}
