// 練功地圖頁的資料整形：分流合併、掉落彙整、需撐命中、排序。純函式，不碰 DB。

import { computeHitRequirement } from "@/lib/calc/hit-requirement";
import type { EntityImage } from "@/lib/queries/images";
import type { SkillHitInfo } from "@/lib/queries/magic";
import type { TrainingStageCategory } from "@/lib/queries/training-classify";
import type { TrainingDropData } from "@/lib/queries/training-drops";
import type { TrainingSpot, TrainingSpotMonster } from "@/lib/types/monster-spawn";

export interface TrainingSpotView extends TrainingSpot {
  category: TrainingStageCategory;
  /** 合併進這張卡的分流（怪物完全相同，例：冰霜雲徑[二]）。 */
  variants: { stageId: number; stageName: string }[];
}

/** 分流名稱去掉結尾的 [二]、[三]、[東] 等標記。 */
export function variantBaseName(name: string): string {
  return name.replace(/\[[^\]]+\]$/, "");
}

const CATEGORY_PRIORITY: Record<TrainingStageCategory, number> = {
  field: 0,
  excluded: 1,
  "npc-only": 2,
  pet: 3,
  story: 4,
  se: 5,
};

/**
 * 同名（去掉分流標記後）且適配怪物完全相同的地圖合成一張。
 * 主卡優先選野外地圖，其次是不帶分流標記的本體，最後是 id 較小者。
 * 怪物不同的同名地圖（例：木人巷兩層等級不同）不合併。
 */
export function mergeTrainingVariants(
  spots: readonly (TrainingSpot & { category: TrainingStageCategory })[],
): TrainingSpotView[] {
  const groups = new Map<string, (TrainingSpot & { category: TrainingStageCategory })[]>();
  for (const s of spots) {
    const roster = s.suitableMonsters
      .map((m) => m.npcId)
      .sort((a, b) => a - b)
      .join(",");
    const key = `${s.stageKind}|${variantBaseName(s.stageName)}|${roster}`;
    const list = groups.get(key);
    if (list) list.push(s);
    else groups.set(key, [s]);
  }

  const merged: TrainingSpotView[] = [];
  for (const group of groups.values()) {
    const sorted = [...group].sort(
      (a, b) =>
        CATEGORY_PRIORITY[a.category] - CATEGORY_PRIORITY[b.category] ||
        Number(a.stageName !== variantBaseName(a.stageName)) -
          Number(b.stageName !== variantBaseName(b.stageName)) ||
        a.stageId - b.stageId,
    );
    const [primary, ...rest] = sorted;
    merged.push({
      ...primary,
      variants: rest.map((r) => ({ stageId: r.stageId, stageName: r.stageName })),
    });
  }
  // 保留輸入順序（以主卡在原陣列的位置為準）。
  const order = new Map(spots.map((s, i) => [`${s.stageKind}:${s.stageId}`, i]));
  return merged.sort(
    (a, b) =>
      order.get(`${a.stageKind}:${a.stageId}`)! - order.get(`${b.stageKind}:${b.stageId}`)!,
  );
}

// ── 掉落 ────────────────────────────────────────────────────────────

export type DropCategory = "equip" | "pet" | "stone" | "rare" | "material" | "potion";

const EQUIP_TYPES = new Set([
  "HELMET",
  "ARMOR",
  "BOOT",
  "CLAW",
  "SHIELD",
  "BOXING",
  "BLADE",
  "PUNCHER",
  "SWORD",
  "STING",
  "STAFF",
  "GREAT_SWORD",
  "WHISK",
  "BOW",
  "ROD",
  "HAMMER",
  "HIDDEN_WEAPON",
  "ORNAMENT",
  "WING",
]);

/** 一般道具掉率到這個門檻（%）以上視為一般素材（多半是賣店的雜物）。 */
export const COMMON_MATERIAL_PERCENT = 5;

export function dropCategory(type: string | null, percent: number): DropCategory {
  if (type && EQUIP_TYPES.has(type)) return "equip";
  if (type === "ITEM_PET") return "pet";
  if (type === "SCARCE_ITEM") return "stone";
  if (type === "POTION") return "potion";
  if (type === "NORMAL_ITEM" && percent >= COMMON_MATERIAL_PERCENT) return "material";
  return "rare";
}

export interface TrainingDrop {
  itemId: number;
  name: string;
  level: number | null;
  icon: EntityImage | null;
  /** 掉這個物品的適配怪物中，單隻每次擊殺的最高掉率（%）。 */
  percent: number;
  sourceName: string;
  sourceElite: boolean;
  category: DropCategory;
}

/** 合併適配怪物的掉落；同一物品取掉率最高的那隻怪。依掉率由高到低排序。 */
export function aggregateSpotDrops(
  monsters: readonly TrainingSpotMonster[],
  data: TrainingDropData,
): TrainingDrop[] {
  const best = new Map<number, { percent: number; monster: TrainingSpotMonster }>();
  for (const m of monsters) {
    for (const d of data.byNpc.get(m.npcId) ?? []) {
      const cur = best.get(d.itemId);
      if (!cur || d.percent > cur.percent) best.set(d.itemId, { percent: d.percent, monster: m });
    }
  }
  const drops: TrainingDrop[] = [];
  for (const [itemId, { percent, monster }] of best) {
    const info = data.items.get(itemId);
    drops.push({
      itemId,
      name: info?.name ?? `物品 #${itemId}`,
      level: info?.level ?? null,
      icon: info?.icon ?? null,
      percent,
      sourceName: monster.name,
      sourceElite: monster.elite,
      category: dropCategory(info?.type ?? null, percent),
    });
  }
  return drops.sort((a, b) => b.percent - a.percent || a.itemId - b.itemId);
}

// ── 需撐命中 ────────────────────────────────────────────────────────

export interface HitRange {
  /** 該門派最好中的招式所需命中。 */
  min: number;
  minSkill: string;
  /** 該門派最難中的招式所需命中（整套招式都穩中的門檻）。 */
  max: number;
  maxSkill: string;
  dodge: number;
  monster: TrainingSpotMonster;
}

export function hitRangeFor(
  monster: TrainingSpotMonster,
  skills: readonly SkillHitInfo[],
): HitRange | null {
  if (monster.dodge == null || monster.dodge <= 0 || skills.length === 0) return null;
  let min = Infinity;
  let max = -Infinity;
  let minSkill = "";
  let maxSkill = "";
  for (const s of skills) {
    const req = computeHitRequirement(monster.dodge, s.minP1, s.maxP1);
    if (req.minRequired < min) {
      min = req.minRequired;
      minSkill = s.name;
    }
    if (req.maxRequired > max) {
      max = req.maxRequired;
      maxSkill = s.name;
    }
  }
  return { min, minSkill, max, maxSkill, dodge: monster.dodge, monster };
}

export interface SpotHit {
  /** 以一般怪（只有菁英符合時以菁英）中閃躲最高者計算。 */
  main: HitRange | null;
  /** 適配窗口內的菁英，各自另列。 */
  elites: HitRange[];
}

export function spotHit(spot: TrainingSpot, skills: readonly SkillHitInfo[]): SpotHit {
  const pool = spot.onlyElite ? spot.suitableMonsters : spot.suitableMonsters.filter((m) => !m.elite);
  const top = pool.reduce<TrainingSpotMonster | null>(
    (acc, m) => ((m.dodge ?? -1) > (acc?.dodge ?? -1) ? m : acc),
    null,
  );
  return {
    main: top ? hitRangeFor(top, skills) : null,
    elites: spot.onlyElite
      ? []
      : spot.suitableMonsters
          .filter((m) => m.elite)
          .map((m) => hitRangeFor(m, skills))
          .filter((r): r is HitRange => r !== null),
  };
}

// ── 排序 ────────────────────────────────────────────────────────────

export type TrainingSort = "spawns" | "hit" | "equip";

export const TRAINING_SORTS: readonly TrainingSort[] = ["spawns", "hit", "equip"];

export function parseTrainingSort(raw: string | undefined): TrainingSort {
  return TRAINING_SORTS.includes(raw as TrainingSort) ? (raw as TrainingSort) : "spawns";
}

/**
 * 只有菁英符合的地圖永遠排在最後；其餘依選擇的排序，平手時以適配刷怪點、地圖 id 決定。
 */
export function sortTrainingSpots<T extends TrainingSpotView>(
  spots: readonly T[],
  sort: TrainingSort,
  extra: { hitMin: (s: T) => number | null; equipCount: (s: T) => number },
): T[] {
  return [...spots].sort((a, b) => {
    const elite = Number(a.onlyElite) - Number(b.onlyElite);
    if (elite !== 0) return elite;
    if (sort === "hit") {
      const ha = extra.hitMin(a) ?? Infinity;
      const hb = extra.hitMin(b) ?? Infinity;
      if (ha !== hb) return ha - hb;
    } else if (sort === "equip") {
      const diff = extra.equipCount(b) - extra.equipCount(a);
      if (diff !== 0) return diff;
    }
    return b.suitableSpawnPoints - a.suitableSpawnPoints || a.stageId - b.stageId;
  });
}
