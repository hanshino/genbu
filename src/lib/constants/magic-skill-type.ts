// magic.skill_type 對照：DB 有 18 個非 null 值（1–14、17–20），2107 筆 null。
// 1–17 來自 E:\SETTING\setting\magicdef.ini 的 MAGIC_* #define；18–20 為資料推斷
// （官方已超出 magicdef.ini 原定義範圍）。詳見 docs/game-setting-codes.md。

export const MAGIC_SKILL_TYPE_LABELS: Record<number, string> = {
  1: "刀法",
  2: "詐招",
  3: "劍法",
  4: "拳腳",
  5: "毒術",
  6: "醫療",
  7: "短劍",
  8: "機關術",
  9: "暗器",
  10: "倭刀",
  11: "忍術",
  12: "棍法",
  13: "拳套",
  14: "符陣",
  15: "加護",
  16: "咒術",
  17: "拂塵",
  18: "禁術",
  19: "靈種",
  20: "劍陣",
};

export function magicSkillTypeLabel(skillType: number | null | undefined): string {
  if (skillType == null) return "—";
  return MAGIC_SKILL_TYPE_LABELS[skillType] ?? `類型 ${skillType}`;
}
