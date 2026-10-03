import type { SectId } from "@/lib/types/stat-sim";

export const floorStat = (value: number): number => Math.floor(value + 1e-9);

interface SectFormula {
  name: string;
  mainClan: string;
  hpA: number;
  hpK: number;
  mp: { level: number; base: number; pow: number; wis: number };
  mdef: (pow: number, wis: number) => number;
}

/** formulas §3：護勁只在文件指定的位置取整。 */
export const SECTS: Record<SectId, SectFormula> = {
  2: {
    name: "惡人谷", mainClan: "CLASS_BAD", hpA: 0.6, hpK: 2.1,
    mp: { level: 5, base: 40, pow: 5, wis: 7 },
    mdef: (p, w) => floorStat(p + 1.5 * w),
  },
  4: {
    name: "移花宮", mainClan: "CLASS_FLOWER", hpA: 0.45, hpK: 1.8,
    mp: { level: 6, base: 40, pow: 6, wis: 9 },
    mdef: (p, w) => floorStat(1.5 * p) + w,
  },
  8: {
    name: "天外天", mainClan: "CLASS_SKY", hpA: 0.4, hpK: 1.7,
    mp: { level: 7, base: 40, pow: 7, wis: 11 },
    mdef: (p, w) => floorStat(1.8 * w) + floorStat(0.7 * p),
  },
  512: {
    name: "火狐", mainClan: "CLASS_FOX_SNOW", hpA: 0.45, hpK: 1.7,
    mp: { level: 6, base: 40, pow: 6, wis: 10 },
    mdef: (p, w) => floorStat(1.5 * p) + w,
  },
  2048: {
    name: "曼陀", mainClan: "CLASS_MONTO_KYLIN", hpA: 0.4, hpK: 1.8,
    mp: { level: 8, base: 80, pow: 8, wis: 12 },
    mdef: (p, w) => 2 * p + w,
  },
  4096: {
    name: "雪狼", mainClan: "CLASS_FOX_SNOW", hpA: 0.5, hpK: 1.7,
    mp: { level: 8, base: 80, pow: 8, wis: 10 },
    mdef: (p, w) => floorStat(1.7 * p + w),
  },
  8192: {
    name: "麒麟", mainClan: "CLASS_MONTO_KYLIN", hpA: 0.45, hpK: 1.9,
    mp: { level: 7, base: 40, pow: 7, wis: 11 },
    mdef: (p, w) => floorStat(1.7 * p) + 2 * w,
  },
};

export const ESTIMATED_POINT_FROM = 146;

/** 從 v−1 加到 v 的單點成本，不是從 1 加到 v 的累積成本。 */
export function pointCost(v: number): number {
  if (!Number.isSafeInteger(v) || v < 1) throw new RangeError("屬性目標值必須是正整數");
  return v <= 10 ? 1 : 2 + Math.floor((v - 11) / 15);
}

/** 累積點數 = slope × 等級 + offset；依起始等級由高到低排列。 */
export const LEVEL_POINT_SEGMENTS = [
  { from: 126, slope: 7, offset: -371 },
  { from: 101, slope: 6, offset: -246 },
  { from: 76, slope: 5, offset: -146 },
  { from: 51, slope: 4, offset: -71 },
  { from: 26, slope: 3, offset: -21 },
  { from: 1, slope: 2, offset: 4 },
] as const;

/** 索引 = 轉生等級 − 100，依 §9 逐筆列出，不以近似公式取代。 */
export const REBIRTH_REWARDS = [
  10, 11, 11, 12, 12, 13, 14, 14, 15, 15, 16,
  17, 17, 18, 18, 19, 20, 20, 21, 21, 22,
  23, 23, 24, 24, 25, 26, 26, 27, 27, 28,
  29, 29, 30, 30, 31, 32, 32, 33, 34, 35,
] as const;

/**
 * 僅列 §4 已記載表值；缺項不是 185，須走估計 fallback。
 * 換算待解，實機資料點（面板含裝，模擬值為空手攻速＋武器攻速，兩筆都多 1）：
 * - 天外天 Lv190 身法 186，倭刀 GREAT_SWORD（武器攻速 +1）：遊戲 14、模擬 15
 * - 移花宮 Lv192 身法 8，劍 SWORD（+1）＋盾：遊戲 7、模擬 8
 */
export const ATTACK_SPEED_TABLE: Record<
  string,
  { default?: number; sects?: Partial<Record<SectId, number>> }
> = {
  UNARMED: { default: 185 },
  STING: { default: 180, sects: { 8: 185 } },
  SWORD: { default: 175, sects: { 4: 180 } },
  STAFF: { default: 165, sects: { 512: 175, 4096: 175, 2048: 175, 8192: 175 } },
  BOXING: { default: 150 },
  CLAW: { sects: { 2048: 180 } },
  WHISK: { sects: { 2: 180 } },
};

export const RANGED_WEAPON_TYPES: readonly string[] = ["BOW", "HIDDEN_WEAPON"];
export const RANGED_UNSUPPORTED_REASON = "v1 未支援遠程物攻";
