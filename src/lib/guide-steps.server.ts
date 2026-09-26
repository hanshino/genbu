import { getDb } from "@/lib/db";
import type { StageKind } from "@/lib/types/stage";
import { getStageMapImage, getNpcPositionsForStage } from "@/lib/queries/maps";
import { getNpcCombatStats } from "@/lib/queries/monsters";
import { buildStepData, type StepData, type StepInput } from "@/lib/guide-steps";

/**
 * stage / sestage 的 id 空間互斥（stage ∈ [1,999]、sestage ∈ [1001,5022]，
 * 見 src/lib/types/stage.ts 開頭註解），因此可以直接從 id 反推 kind，
 * 不需要在 StepInput 加欄位。魔族禁地（379–384）是本站第一個用一般 stage
 * 地圖的迷宮攻略，之前的謎霧之森等新副本全部是 sestage。
 */
function stageKindOf(id: number): StageKind {
  return id < 1000 ? "stage" : "sestage";
}

/**
 * getStepData 是唯一會打 DB 的部分，刻意獨立成這個檔案（而非放進
 * src/lib/guide-steps.ts）：guide-steps.ts 的其餘 pure fn（cropFrame/toPercent/
 * buildStepData…）會被 "use client" 的 step-map.tsx import，若把 getDb /
 * better-sqlite3 的 import 混進同一個檔案，client bundle 會被迫一起打包
 * native module 而炸掉。只能在 Server Component / Route Handler 呼叫。
 */
export function getStepData(input: StepInput): StepData {
  const { stage, crop = null, groups = [], marks = [] } = input;
  const kind = stageKindOf(stage);

  const db = getDb();
  const stageRow = db
    .prepare(`SELECT name FROM stages WHERE kind = ? AND id = ?`)
    .get(kind, stage) as { name: string | null } | undefined;

  const image = getStageMapImage(kind, stage);

  const ids = new Set<number>();
  for (const g of groups) for (const id of g.ids) ids.add(id);
  for (const m of marks) ids.add(m.id);
  const idList = [...ids];

  const stats = getNpcCombatStats(idList);
  const points = getNpcPositionsForStage(kind, stage, idList);

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
