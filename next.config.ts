import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true },
  distDir: process.env.NEXT_DIST_DIR || ".next",
  images: { unoptimized: true },
};

export default nextConfig;
