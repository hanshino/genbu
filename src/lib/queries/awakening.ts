import { getDb } from "@/lib/db";
import type { Item } from "@/lib/types/item";
import type { AwakeningBonus, AwakeningPath, AwakeningStage } from "@/lib/types/awakening";

export function levelToGenPrefix(level: number): string | null {
  if (level < 1) return null;
  if (level >= 200) return "200";
  if (level >= 180) return "180";
  if (level >= 160) return "160";
  if (level >= 140) return "140";
  if (level >= 120) return "120";
  if (level >= 100) return "100";
  if (level >= 80) return "80";
  if (level >= 60) return "60";
  if (level >= 40) return "40";
  return "20"; // 1~39
}

const ARMOR_TYPES = new Set(["鞋", "衣", "甲", "盾", "帽", "座騎"]);
const ACCESSORY_TYPES = new Set(["中飾", "左飾", "右飾", "背飾"]);
const ONE_HAND_WEAPONS = new Set(["劍", "刀", "匕首", "扇", "拂塵", "拳刃", "雙劍", "暗器", "棍"]);

export function itemTypeToSlotPrefix(type: string | null): string | null {
  if (!type) return null;
  if (ARMOR_TYPES.has(type)) return type;
  if (ACCESSORY_TYPES.has(type)) return type;
  if (ONE_HAND_WEAPONS.has(type)) return "單手武器";
  if (type === "雙手刀") return "雙手武器";
  if (type === "法杖") return "法術武器";
  return null;
}

const BONUS_LABELS: Record<string, string> = {
  ITEM_BONUS_DEF: "防禦",
  ITEM_BONUS_MDEF: "魔防",
  ITEM_BONUS_ATK: "物攻",
  ITEM_BONUS_MATK: "內勁",
  ITEM_BONUS_HP: "體力",
  ITEM_BONUS_MP: "內力",
  ITEM_BONUS_DODGE: "閃躲",
  ITEM_BONUS_HIT: "命中",
  ITEM_BONUS_CRITICAL: "暴擊",
  ITEM_BONUS_UNCANNYDODGE: "閃避反擊",
  ITEM_BONUS_STR: "力量",
  ITEM_BONUS_VIT: "體質",
  ITEM_BONUS_DEX: "技巧",
  ITEM_BONUS_AGI: "敏捷",
  ITEM_BONUS_POW: "悟性",
  ITEM_BONUS_WIS: "意志",
};

interface FormulaRow {
  name: string;
  money: number;
  material_core_id: number;
  material_core_amount: number;
  success_prob: number;
  bonus_type: string;
  bonus_value: string;
  material_name: string | null;
}

export function getAwakeningPath(item: Item): AwakeningPath | null {
  const gen = levelToGenPrefix(item.level);
  const slot = itemTypeToSlotPrefix(item.type);
  if (!gen || !slot) return null;

  const prefix = `${gen}${slot}`;
  const db = getDb();

  const rows = db
    .prepare(
      `SELECT sf.name, sf.money, sf.material_core_id, sf.material_core_amount,
              sf.success_prob, sf.bonus_type, sf.bonus_value,
              i.name AS material_name
       FROM strong_formula sf
       LEFT JOIN items i ON i.id = sf.material_core_id
       WHERE sf.name LIKE ? AND sf.name NOT LIKE '%"%'`,
    )
    .all(`${prefix}+%`) as FormulaRow[];

  if (rows.length === 0) return null;

  // Group rows by stage number, parsing the suffix after `${prefix}+`.
  const byStage = new Map<number, FormulaRow[]>();
  for (const row of rows) {
    const stageStr = row.name.slice(prefix.length + 1);
    const stage = Number.parseInt(stageStr, 10);
    if (!Number.isInteger(stage) || stage < 1 || stage > 20) continue;
    const list = byStage.get(stage) ?? [];
    list.push(row);
    byStage.set(stage, list);
  }

  const stages: AwakeningStage[] = [];
  for (const [stage, group] of [...byStage.entries()].sort((a, b) => a[0] - b[0])) {
    // For each bonus_type, keep the row with the highest material_core_id —
    // resolves both pure duplicates and the 100右飾 dual-path quirk by
    // preferring the newer/premium tier (higher material_core_id == later token).
    const bestPerType = new Map<string, FormulaRow>();
    for (const r of group) {
      const existing = bestPerType.get(r.bonus_type);
      if (!existing || r.material_core_id > existing.material_core_id) {
        bestPerType.set(r.bonus_type, r);
      }
    }

    const chosen = [...bestPerType.values()].sort((a, b) =>
      a.bonus_type.localeCompare(b.bonus_type),
    );
    const bonuses: AwakeningBonus[] = chosen.map((r) => ({
      bonusType: r.bonus_type,
      label: BONUS_LABELS[r.bonus_type] ?? r.bonus_type,
      value: Number(r.bonus_value),
    }));

    // Stage headline cost/material/prob: take from the row with highest material_core_id
    // across all bonuses (covers the 100右飾 case where money/material differ between paths).
    const headline = chosen.reduce((acc, r) =>
      r.material_core_id > acc.material_core_id ? r : acc,
    );
    stages.push({
      stage,
      money: headline.money,
      materialId: headline.material_core_id,
      materialName: headline.material_name ?? `#${headline.material_core_id}`,
      materialAmount: headline.material_core_amount,
      successProb: headline.success_prob / 1_000_000,
      bonuses,
    });
  }

  return { prefix, stages };
}
