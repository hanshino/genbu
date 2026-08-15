export const COMPOUND_TYPE_LABELS: Record<string, string> = {
  ITEM_COMPOUND_EQUIPMENT: "裝備強化",
  ITEM_COMPOUND_ORNAMENT: "飾品/還原",
  ITEM_COMPOUND_ITEM: "道具合成",
  ITEM_COMPOUND_GROUP: "群組節點",
};

/** 顯示順序：強化最常用、群組節點最次要。 */
export const COMPOUND_TYPE_ORDER: readonly string[] = [
  "ITEM_COMPOUND_EQUIPMENT",
  "ITEM_COMPOUND_ORNAMENT",
  "ITEM_COMPOUND_ITEM",
  "ITEM_COMPOUND_GROUP",
];

export function compoundTypeRank(type: string): number {
  const i = COMPOUND_TYPE_ORDER.indexOf(type);
  return i === -1 ? COMPOUND_TYPE_ORDER.length : i;
}

/**
 * compounds.level 對魂石／魂珠類配方不是玩家等級：
 * 魂石五群（group 2–6）全部恰為 1001，魂珠類落在 1005–2004，
 * 是階級或序號編碼。顯示等級時必須排除，否則會出現「Lv1001」這種不存在的等級。
 */
export const MAX_COMPOUND_PLAYER_LEVEL = 200;

export function isCompoundPlayerLevel(level: number | null | undefined): boolean {
  return level != null && level > 0 && level <= MAX_COMPOUND_PLAYER_LEVEL;
}
