import type { Metadata } from "next";
import { BackLink } from "@/components/common/back-link";
import { SevenStarSolver } from "@/components/tools/seven-star-solver";

export const metadata: Metadata = {
  title: "175 北斗七星 | Genbu",
  description: "北斗七星開關解題器。",
};

export default function SevenStarPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <nav className="mb-4 text-sm text-muted-foreground">
        <BackLink href="/tools">返回工具列表</BackLink>
      </nav>
      <header className="mb-6">
        <h1 className="font-heading text-3xl font-bold">175 副本 — 北斗七星</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          輸入大機關給的數字（1~127），即時顯示每顆星的開關狀態。也可直接點擊星星切換開關。
        </p>
      </header>
      <SevenStarSolver />
    </div>
  );
}
