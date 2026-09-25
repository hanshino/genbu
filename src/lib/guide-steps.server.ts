import { getDb } from "@/lib/db";
import { getStageMapImage, getNpcPositionsForStage } from "@/lib/queries/maps";
import { getNpcCombatStats } from "@/lib/queries/monsters";
import { buildStepData, type StepData, type StepInput } from "@/lib/guide-steps";

// ponytail: 迷宮攻略目前只有 sestage 地圖（謎霧之森等新副本都是 sestage），
// StepInput 是凍結型別、沒有 kind 欄位；要支援一般 stage 副本時再擴充 StepInput
// 加上可選的 kind 欄位，這裡跟著改成依輸入決定。
const STAGE_KIND = "sestage" as const;

/**
 * getStepData 是唯一會打 DB 的部分，刻意獨立成這個檔案（而非放進
 * src/lib/guide-steps.ts）：guide-steps.ts 的其餘 pure fn（cropFrame/toPercent/
 * buildStepData…）會被 "use client" 的 step-map.tsx import，若把 getDb /
 * better-sqlite3 的 import 混進同一個檔案，client bundle 會被迫一起打包
 * native module 而炸掉。只能在 Server Component / Route Handler 呼叫。
 */
export function getStepData(input: StepInput): StepData {
  const { stage, crop = null, groups = [], marks = [] } = input;

  const db = getDb();
  const stageRow = db
    .prepare(`SELECT name FROM stages WHERE kind = ? AND id = ?`)
    .get(STAGE_KIND, stage) as { name: string | null } | undefined;

  const image = getStageMapImage(STAGE_KIND, stage);

  const ids = new Set<number>();
  for (const g of groups) for (const id of g.ids) ids.add(id);
  for (const m of marks) ids.add(m.id);
  const idList = [...ids];

  const stats = getNpcCombatStats(idList);
  const points = getNpcPositionsForStage(STAGE_KIND, stage, idList);

  return buildStepData({
    stageId: stage,
    stageName: stageRow?.name ?? `場景 ${stage}`,
    image,
    crop,
    groups,
    marks,
    stats,
    points,
  });
}
