import { getDb } from "@/lib/db";
import type { StageKind } from "@/lib/types/stage";
import {
  getStageMapImage,
  getNpcPositionsForStage,
  getWalkRegion,
  regionHas,
} from "@/lib/queries/maps";
import { getNpcCombatStats } from "@/lib/queries/monsters";
import {
  buildStepData,
  inCrop,
  routeBox,
  type Crop,
  type StepData,
  type StepInput,
  type StepRoute,
  type StepWalk,
} from "@/lib/guide-steps";
import type { StageMapImage } from "@/lib/queries/maps";

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
  const { stage, crop = null, groups = [], marks = [], walk = [], routes = [] } = input;
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
  return {
    ...data,
    walk: getWalks(stage, crop, walk),
    routes: getRoutes(stage, crop, image, routes),
  };
}

/**
 * 路線整條驗證，任何一點出問題就整條略過（DungeonStep 在開發模式會提示）：
 * 所有點都要在本區塊內；步行段（不是從傳點出發的那段）兩端要在同一個可行走區。
 * 查不到可行走資料（舊版 DB、起點不可走）時不做連通檢查，只檢查區塊。
 */
function getRoutes(
  stage: number,
  crop: Crop | null,
  image: StageMapImage | null,
  input: NonNullable<StepInput["routes"]>,
): StepRoute[] {
  if (!image) return [];
  const bounds: Crop = crop ?? [0, 0, image.imgWidth, image.imgHeight];
  return input.flatMap((r) => {
    const points = r.points.map(([as, x, y]) => ({ as, x, y }));
    if (points.length === 0) return [];
    if (!points.every((p) => inCrop(p, bounds))) return [];
    for (let i = 1; i < points.length; i++) {
      if (points[i - 1].as === "portal") continue;
      const region = getWalkRegion(stageKindOf(stage), stage, points[i - 1]);
      if (region && !regionHas(region, points[i])) return [];
    }
    return [{ label: r.label, note: r.note ?? null, points, box: routeBox(points, bounds) }];
  });
}

/**
 * 每個傳點（at）展開成一條通道；同一個連通區只留第一條（兩個起點其實相通時不會畫成兩條，
 * 所以「通道互不相通」的說法才成立）。查無遮罩或起點不可走的直接略過。
 * 傳點／落點不在本區塊內就不畫；落點不在同一條通道也不畫（DungeonStep 在開發模式會提示）。
 */
function getWalks(
  stage: number,
  crop: Crop | null,
  input: NonNullable<StepInput["walk"]>,
): StepWalk[] {
  const out: StepWalk[] = [];
  for (const w of input) {
    const portal = { x: w.at[0], y: w.at[1] };
    const region = getWalkRegion(stageKindOf(stage), stage, portal);
    if (!region || out.some((o) => o.path === region.path)) continue;
    const landing = w.landing ? { x: w.landing[0], y: w.landing[1] } : null;
    out.push({
      label: w.label,
      note: w.note ?? null,
      path: region.path,
      labelAt: labelAt(region.cells, region.width, crop),
      portal: inCrop(portal, crop) ? portal : null,
      landing: landing && inCrop(landing, crop) && regionHas(region, landing) ? landing : null,
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
