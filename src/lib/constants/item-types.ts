// 45 種道具分類，以群組組織，供 UI 分層篩選使用。
// 所有名稱必須與 SQLite items.type 欄位完全一致。

export interface TypeGroup {
  id: string;
  label: string;
  types: readonly string[];
}

export const itemTypeGroups: readonly TypeGroup[] = [
  {
    id: "armor",
    label: "裝備 — 防具",
    types: ["帽", "衣", "鞋"],
  },
  {
    id: "accessory",
    label: "裝備 — 飾品",
    types: ["左飾", "中飾", "右飾"],
  },
  {
    id: "special",
    label: "裝備 — 特殊",
    types: ["座騎", "背飾"],
  },
  {
    id: "weapon",
    label: "裝備 — 武器",
    types: [
      "刀", "劍", "匕首", "拳刃", "盾", "手套", "法杖",
      "扇", "雙手刀", "拂塵", "手甲", "棍", "雙劍", "暗器",
    ],
  },
  {
    id: "consumable",
    label: "消耗品",
    types: ["藥品", "卷軸"],
  },
  {
    id: "chest",
    label: "寶箱",
    types: ["寶箱"],
  },
  {
    id: "pet",
    label: "寵物飾品",
    types: ["火寵飾", "水寵飾", "木寵飾", "雷寵飾"],
  },
  {
    id: "skin",
    label: "外裝",
    types: [
      "座騎[外裝]", "背飾[外裝]", "帽[外裝]", "衣[外裝]",
      "鞋[外裝]", "右武器[外裝]", "左武器[外裝]", "飾品[外裝]", "盾[外裝]",
    ],
  },
  {
    id: "misc",
    label: "其他",
    types: ["真元/魂石", "娃娃", "機關人", "未知1", "未知2", "未知3"],
  },
] as const;

export const allItemTypes: readonly string[] = itemTypeGroups.flatMap(
  (g) => g.types
);

// 依 type 字串反查所屬群組
export function getGroupForType(type: string | null): TypeGroup | null {
  if (!type) return null;
  return itemTypeGroups.find((g) => g.types.includes(type)) ?? null;
}
