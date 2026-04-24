// monsters.type / npc.type：DB 值域 13–19（7 類）。
// 來自 E:\SETTING\MONSTER.INI 的資料分組推斷（無官方 #define），詳見 docs/game-setting-codes.md。

export const MONSTER_TYPE_LABELS: Record<number, string> = {
  13: "水族",
  14: "野獸",
  15: "蟲類",
  16: "植物",
  17: "人形",
  18: "機關",
  19: "妖魔",
};

export const MONSTER_TYPE_ORDER: readonly number[] = [13, 14, 15, 16, 17, 18, 19];

export function monsterTypeLabel(type: number | null | undefined): string {
  if (type == null) return "—";
  return MONSTER_TYPE_LABELS[type] ?? `類型 ${type}`;
}
