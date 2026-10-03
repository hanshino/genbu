import { getDb } from "@/lib/db";
import {
  TRAINING_EXCLUDED_NAMES,
  TRAINING_FIELD_STAGE_IDS,
  TRAINING_NAME_RULES,
} from "@/configs/training-spots";
import type { StageKind } from "@/lib/types/stage";

/**
 * 練功地圖分類：
 * - field：野外練功地圖（主列表）
 * - npc-only：城鎮走不到，只能找 NPC 傳送（副本／任務）
 * - pet：寵物練功場
 * - story：劇情、試煉、測試、保留用地圖
 * - se：SESTAGE 特殊地圖（莊園、迷境等）
 * - excluded：走得到但人工判定為副本（見 configs/training-spots.ts）
 */
export type TrainingStageCategory = "field" | "npc-only" | "pet" | "story" | "se" | "excluded";

let walkableCache: Set<number> | null = null;

/**
 * 從所有城鎮（STAGE_FLAG_SAFE）出發，只沿著「走過去就會傳送」的傳送點
 * （map_warps.warp_kind = auto / map_event）能到的 stage id。
 * NPC 對話傳送（dialogue）不算：副本、任務地圖的入口都是這一類。
 * 與等級無關且 DB 唯讀，整個 process 只算一次。
 */
function getWalkableStageIds(): Set<number> {
  if (walkableCache) return walkableCache;
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT NULL AS src, id AS dst FROM stages
         WHERE kind = 'stage' AND flag LIKE '%STAGE_FLAG_SAFE%'
       UNION ALL
       SELECT src_stage_id AS src, dst_stage_id AS dst FROM map_warps
         WHERE src_kind = 'stage' AND warp_kind IN ('auto', 'map_event')`,
    )
    .all() as Array<{ src: number | null; dst: number }>;

  const towns: number[] = [];
  const adjacency = new Map<number, number[]>();
  for (const r of rows) {
    if (r.src === null) {
      towns.push(r.dst);
      continue;
    }
    const list = adjacency.get(r.src);
    if (list) list.push(r.dst);
    else adjacency.set(r.src, [r.dst]);
  }

  const seen = new Set(towns);
  const queue = [...towns];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const next of adjacency.get(cur) ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  walkableCache = seen;
  return seen;
}

export function classifyTrainingStage(stage: {
  stageKind: StageKind;
  stageId: number;
  stageName: string;
}): TrainingStageCategory {
  if (stage.stageKind === "sestage") return "se";
  if (TRAINING_FIELD_STAGE_IDS.has(stage.stageId)) return "field";
  if (TRAINING_EXCLUDED_NAMES.has(stage.stageName)) return "excluded";
  for (const rule of TRAINING_NAME_RULES) {
    if (rule.pattern.test(stage.stageName)) return rule.category;
  }
  return getWalkableStageIds().has(stage.stageId) ? "field" : "npc-only";
}
