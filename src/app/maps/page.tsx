import type { Metadata } from "next";
import {
  getAllStageGroupStats,
  getAllStageListItems,
} from "@/lib/queries/stages";
import { MapList } from "@/components/maps/map-list";

// 列表篩選存在 URL（client 端 useSearchParams 讀取）；動態渲染才能 SSR 出已篩選的結果，
// 靜態頁會要求 Suspense 並讓整個列表變成 client-only。
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "地圖 · 玄武",
  description: "瀏覽全部場景地圖、所屬區域與屬性旗標",
  alternates: { canonical: "/maps" },
};

export default function MapsHubPage() {
  const stages = getAllStageListItems();
  const groups = getAllStageGroupStats();

  const total = stages.length;
  const groupCount = groups.length;
  const safeCount = stages.filter(
    (s) => s.flags.includes("STAGE_FLAG_SAFE") || s.flags.includes("STAGE_FLAG_NOFIGHT"),
  ).length;
  const pkCount = stages.filter((s) => s.flags.includes("STAGE_FLAG_PK")).length;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">地圖</h1>
        <p className="text-sm text-muted-foreground">
          {total.toLocaleString()} 張地圖 · {groupCount} 個區域 · {safeCount} 安全區 · {pkCount} 可 PK
        </p>
      </header>

      <MapList stages={stages} groups={groups} />

      <p className="text-xs text-muted-foreground">
        資料來自 STAGE.INI / SESTAGE.INI；區域編號為原始 GROUP 欄位。
        旗標翻譯依語意推斷，可能與遊戲實際行為有出入。
      </p>
    </div>
  );
}
