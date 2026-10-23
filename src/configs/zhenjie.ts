// 真解（items.use_case = 23）的加成公式。
// 來源：tthol-emulator docs/specs/zhenjie.md、tthol-data scripts/zhenjie_investigation.md。
// item_rand 的 min/max 對真解都是 0：數值不在 ModProb 裡，而是由強度 M 推出，
// M 落在該書 item_rand_counts 的 comp_count_min..max。每條顯示值 = max(1, ⌊M·mul/div⌋)，
// mul/div 取自 client 跳躍表 0x47e184。

export interface ZhenjieBonusDef {
  token: string;
  label: string;
  /** 顯示格式：ratio = 0.01 倍、flat = 固定值、percent = %、ms = 毫秒 */
  unit: "ratio" | "flat" | "percent" | "ms";
  mul: number;
  div: number;
}

/** 依 item_rand.seq 排列（也是真解 u32 的 bit 0..7）。 */
export const ZHENJIE_BONUSES: readonly ZhenjieBonusDef[] = [
  { token: "ITEM_MAG_BONUS_DMG_P1", label: "技能倍率", unit: "ratio", mul: 125, div: 100 },
  { token: "ITEM_MAG_BONUS_DMG_P2", label: "技能傷害", unit: "flat", mul: 35, div: 1 },
  { token: "ITEM_MAG_BONUS_HIT_P1", label: "命中率", unit: "percent", mul: 5, div: 100 },
  { token: "ITEM_MAG_BONUS_STUN", label: "間隔時間", unit: "ms", mul: 150, div: 100 },
  { token: "ITEM_MAG_BONUS_RCHAR_TIME", label: "施放時間", unit: "ms", mul: 150, div: 100 },
  { token: "ITEM_MAG_BONUS_STATU_PROB", label: "狀態附加機率", unit: "percent", mul: 10, div: 100 },
  { token: "ITEM_MAG_BONUS_STATU_TIME", label: "狀態持續時間", unit: "percent", mul: 15, div: 100 },
  { token: "ITEM_MAG_BONUS_SPEND_MP", label: "減少真氣消耗", unit: "percent", mul: 15, div: 100 },
];

/** 官方更新公告寫的強度上限（例：傷害 7000 = 200·35），高於 ITEMRAND.INI 的最高 170。 */
export const ZHENJIE_OFFICIAL_MAX_M = 200;

/** 強度 M 下某條加成的值（ratio 單位為 0.01 倍）。 */
export function zhenjieBonusValue(m: number, def: ZhenjieBonusDef): number {
  return Math.max(1, Math.floor((m * def.mul) / def.div));
}

export function formatZhenjieValue(value: number, unit: ZhenjieBonusDef["unit"]): string {
  switch (unit) {
    case "ratio":
      return `${(value / 100).toFixed(2)} 倍`;
    case "flat":
      return value.toLocaleString();
    case "percent":
      return `${value}%`;
    case "ms":
      return `${value} ms`;
  }
}
