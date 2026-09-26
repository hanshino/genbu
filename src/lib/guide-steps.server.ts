import { getDb } from "@/lib/db";
import type { StageKind } from "@/lib/types/stage";
import { getStageMapImage, getNpcPositionsForStage, getWalkRegion } from "@/lib/queries/maps";
import { getNpcCombatStats } from "@/lib/queries/monsters";
import {
  buildStepData,
  inCrop,
  type Crop,
  type StepData,
  type StepInput,
  type StepWalk,
} from "@/lib/guide-steps";

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
  const { stage, crop = null, groups = [], marks = [], walk = [] } = input;
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

  const data = buildStepData({
    stageId: stage,
    stageName: stageRow?.name ?? `場景 ${stage}`,
    image,
    crop,
    groups,
    marks,
    stats,
    points,
  });
  return { ...data, walk: getWalks(stage, crop, walk) };
}

/**
 * 每個起點展開成一條通道；同一個連通區只留第一條（兩個起點其實相通時不會畫成兩條，
 * 所以「通道互不相通」的說法才成立）。查無遮罩或起點不可走的直接略過。
 */
function getWalks(
  stage: number,
  crop: Crop | null,
  input: NonNullable<StepInput["walk"]>,
): StepWalk[] {
  const out: StepWalk[] = [];
  for (const w of input) {
    const region = getWalkRegion(stageKindOf(stage), stage, { x: w.at[0], y: w.at[1] });
    if (!region || out.some((o) => o.path === region.path)) continue;
    out.push({
      label: w.label,
      note: w.note ?? null,
      path: region.path,
      labelAt: labelAt(region.cells, region.width, crop),
    });
  }
  return out;
}

/** 本區塊內最上面一列可走格的中位數那格（一定是通道內的格子）；區塊外沒格子就退回整條通道。 */
function labelAt(cells: number[], width: number, crop: Crop | null): { x: number; y: number } {
  const center = (k: number) => ({ x: (k % width) * 40 + 20, y: Math.floor(k / width) * 40 + 20 });
  const inside = cells.filter((k) => inCrop(center(k), crop));
  const pool = inside.length > 0 ? inside : cells;
  const top = Math.min(...pool.map((k) => Math.floor(k / width)));
  const row = pool.filter((k) => Math.floor(k / width) === top).sort((a, b) => a - b);
  return center(row[Math.floor(row.length / 2)]);
}
