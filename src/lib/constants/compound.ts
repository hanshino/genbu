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
