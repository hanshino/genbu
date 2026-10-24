import type { Metadata } from "next";
import { ToolCard } from "@/components/tools/tool-card";

export const metadata: Metadata = {
  title: "工具總覽 | Genbu",
  description: "查詢強化配方與使用副本解謎工具。",
  alternates: { canonical: "/tools" },
};

export default function ToolsHubPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-8">
        <h1 className="font-heading text-3xl font-bold">工具總覽</h1>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ToolCard
          href="/tools/enhance"
          title="強化查詢"
          description="附單次機率與期望消耗顆數"
        />
        <ToolCard
          href="/tools/meridian"
          title="經脈模擬器"
          description="還沒到 180 等也能先試"
        />
        <ToolCard
          href="/tools/stat-sim"
          title="屬性模擬器"
          description="面板數值逐項列出來源"
        />
        <ToolCard
          href="/tools/160"
          title="160 迷霧九宮格"
        />
        <ToolCard
          href="/tools/175"
          title="175 北斗七星"
        />
        <ToolCard
          href="/tools/180"
          title="180 神武禁地"
        />
        <ToolCard
          href="/tools/salon"
          title="易容閣"
          description="試穿外觀、坐騎與染髮，可分享連結"
        />
      </div>
    </div>
  );
}
