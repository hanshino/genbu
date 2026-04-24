// skill_type 對照：DB 有 17 個非 null 值（1–20 有空洞），2107 筆 null。
// TODO: 校對遊戲內實際類型名稱後替換；目前以數字 + fallback 顯示。

export const MAGIC_SKILL_TYPE_LABELS: Record<number, string> = {
  // 依 bot controller skipKeys 忽略推測為內部分類，先全部標未定。
  // 1: "",
  // 2: "",
  // 3: "",
  // 4: "",
  // 5: "",
  // 6: "",
  // 7: "",
  // 8: "",
  // 9: "",
  // 10: "",
  // 11: "",
  // 12: "",
  // 13: "",
  // 14: "",
  // 17: "",
  // 18: "",
  // 19: "",
  // 20: "",
};

export function magicSkillTypeLabel(skillType: number | null | undefined): string {
  if (skillType == null) return "—";
  return MAGIC_SKILL_TYPE_LABELS[skillType] ?? `類型 ${skillType}`;
}
