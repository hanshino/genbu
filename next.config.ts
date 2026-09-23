import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // better-sqlite3 uses native bindings; Next must not bundle it
  serverExternalPackages: ["better-sqlite3"],
  // content/guides/*.mdx 是 runtime fs 讀取，standalone build 的 file tracing
  // 不會自動偵測到（沒有 static import），需要手動宣告讓它跟著複製進 standalone 輸出。
  outputFileTracingIncludes: {
    "/guides": ["./content/guides/**"],
    "/guides/[slug]": ["./content/guides/**"],
    "/sitemap.xml": ["./content/guides/**"],
  },
};

export default nextConfig;
