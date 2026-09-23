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
  1: "text-red-700 border-red-500/40 bg-red-500/10 dark:text-red-300",
  2: "text-blue-700 border-blue-500/40 bg-blue-500/10 dark:text-blue-300",
  3: "text-amber-700 border-amber-500/40 bg-amber-500/10 dark:text-amber-300",
  4: "text-emerald-700 border-emerald-500/40 bg-emerald-500/10 dark:text-emerald-300",
};

export function magicAttribLabel(attrib: number | null | undefined): string | null {
  if (attrib == null) return null;
  return MAGIC_ATTRIB_LABELS[attrib] ?? `屬性${attrib}`;
}
