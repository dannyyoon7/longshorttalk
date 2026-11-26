import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "롱숏톡 — 코인 선물 모의투자",
    short_name: "롱숏톡",
    description:
      "비트코인·이더리움 선물 모의투자, 실시간 채팅, 수익률 랭킹을 한 화면에서.",
    start_url: "/",
    display: "standalone",
    background_color: "#0B0E11",
    theme_color: "#0B0E11",
    lang: "ko",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
