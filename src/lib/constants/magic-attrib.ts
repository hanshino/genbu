// magic.attrib 元素屬性：1/2/3/4 + null
// 來自 E:\SETTING\setting\magicdef.ini：ELEM_FIRE=1 / ELEM_WATER=2 / ELEM_LIGHTNING=3 / ELEM_EARTH=4。
// 注意：怪物側 MONSTER.INI 把 code 4 稱為 WOOD（對應 WoodDef），技能側叫 EARTH — 同一代碼不同命名。
export const MAGIC_ATTRIB_LABELS: Record<number, string> = {
  1: "火",
  2: "水",
  3: "雷",
  4: "土",
};

// 元素 → Tailwind 顏色 class（用於 badge 視覺一致）
export const MAGIC_ATTRIB_COLOR: Record<number, string> = {
  1: "text-red-600 border-red-200 bg-red-50",
  2: "text-blue-600 border-blue-200 bg-blue-50",
  3: "text-amber-600 border-amber-200 bg-amber-50",
  4: "text-emerald-600 border-emerald-200 bg-emerald-50",
};

export function magicAttribLabel(attrib: number | null | undefined): string | null {
  if (attrib == null) return null;
  return MAGIC_ATTRIB_LABELS[attrib] ?? `屬性${attrib}`;
}
