import type { Metadata } from "next";
import { ToolCard } from "@/components/tools/tool-card";

export const metadata: Metadata = {
  title: "工具總覽 | Genbu",
  description: "查詢強化配方與使用副本解謎工具。",
};

export default function ToolsHubPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-8">
        <h1 className="font-heading text-3xl font-bold">工具總覽</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          查詢強化配方，或使用副本解謎工具。
        </p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ToolCard
          href="/tools/enhance"
          title="強化查詢"
          subtitle="真元／魂石強化"
          description="依屬性反查可用的真元、魂珠與魂石強化配方，附單次機率與期望消耗顆數。"
        />
        <ToolCard
          href="/tools/160"
          title="160 副本"
          subtitle="迷霧九宮格"
          description="輸入總和與兩間關閉房間，推算其餘 7 間的水晶數。"
        />
        <ToolCard
          href="/tools/175"
          title="175 副本"
          subtitle="北斗七星"
          description="輸入數字（1~127）即時計算七顆星的開關狀態。"
        />
        <ToolCard
          href="/tools/180"
          title="180 副本"
          subtitle="神武禁地"
          description="輸入總和與左上中（封印）數字，列出所有合法排列。"
        />
      </div>
    </div>
  );
}
