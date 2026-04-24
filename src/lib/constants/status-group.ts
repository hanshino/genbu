// status.group 對照：1–38 來自 E:\SETTING\setting\statusdef.ini 的 GS_* #define；
// 實際 DB 值域可到 66（遊戲後加、無符號名）— 查不到時 fallback「群組 N」。

export const STATUS_GROUP_LABELS: Record<number, string> = {
  1: "殺氣",
  2: "冰心",
  3: "針灸",
  4: "加速",
  5: "調息",
  6: "調氣",
  7: "抗火",
  8: "抗水",
  9: "抗雷",
  10: "抗土",
  11: "抗魔",
  12: "咒甲",
  13: "劍舞",
  14: "盲眼",
  15: "卸胄",
  16: "現形",
  17: "麻痺",
  18: "冰凍",
  19: "中毒",
  20: "緩速",
  21: "攻降",
  22: "火燒",
  23: "暈眩",
  24: "隱形",
  25: "葉刃",
  26: "分身",
  27: "替身",
  28: "寒冰",
  29: "照明",
  30: "吐納",
  31: "血契",
  32: "靈契",
  33: "魔化",
  34: "易容",
  35: "激攻",
  36: "靈護",
  37: "反射",
  38: "石化",
};

export function statusGroupLabel(group: number | null | undefined): string {
  if (group == null) return "—";
  return STATUS_GROUP_LABELS[group] ?? `群組 ${group}`;
}
