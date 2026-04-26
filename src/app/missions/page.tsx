import type { Metadata } from "next";
import {
  getAllMissionGroupStats,
  getAllMissionListItems,
} from "@/lib/queries/missions";
import { MissionList } from "@/components/missions/mission-list";

export const metadata: Metadata = {
  title: "任務 · 玄武",
  description: "瀏覽全部任務、步驟與所需物品",
};

export default function MissionsHubPage() {
  const groups = getAllMissionGroupStats();
  const missions = getAllMissionListItems();

  const total = missions.length;
  const cycleCount = missions.filter((m) => m.cycleTime != null).length;
  const groupCount = groups.filter((g) => g.groupId != null).length;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">任務</h1>
        <p className="text-sm text-muted-foreground">
          {total.toLocaleString()} 個任務 · {groupCount} 個分組 · {cycleCount} 個可重複
        </p>
      </header>

      <MissionList missions={missions} groups={groups} />

      <p className="text-xs text-muted-foreground">
        資料來自 MISSION.INI；分組編號為原始 GROUP 欄位的整數值。
        步驟內提到的物品已連結到對應的道具頁。
      </p>
    </div>
  );
}
