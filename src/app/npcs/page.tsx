import type { Metadata } from "next";
import { searchNpcs } from "@/lib/queries/npcs";
import { NpcList } from "@/components/npcs/npc-list";

// 篩選存在 URL（client 端 useSearchParams 讀取）；動態渲染才能 SSR 出已篩選的結果。
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "NPC 位置查詢 · 玄武",
  description: "搜尋武林同萌傳 NPC，查出它出現在哪些地圖",
  alternates: { canonical: "/npcs" },
};

export default function NpcsPage() {
  // ponytail: 全部載入後在 client 過濾（約千筆），筆數大到卡頓再改成 server 搜尋 + 分頁
  const npcs = searchNpcs("");

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">NPC 位置查詢</h1>
        <p className="text-sm text-muted-foreground">
          共 {npcs.length.toLocaleString()} 位 NPC · 點進去看出現在哪些地圖
        </p>
      </header>

      <NpcList npcs={npcs} />
    </div>
  );
}
