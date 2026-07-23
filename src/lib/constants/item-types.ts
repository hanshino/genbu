// 45 種道具分類，以群組組織，供 UI 分層篩選使用。
// 所有名稱必須與 SQLite items.type_name 欄位（英文列舉）完全一致。

export interface TypeGroup {
  id: string;
  label: string;
  types: readonly string[];
}

// 英文 type_name → 中文顯示名稱。權威對照表，勿依字面英文自行重譯
// （例如 HAMMER 實際是雙劍、BOW 是手甲、CLAW 是扇，皆與字面義不同）。
export const ITEM_TYPE_LABELS: Record<string, string> = {
  SWORD: "劍",
  BLADE: "刀",
  HAMMER: "雙劍",
  ROD: "棍",
  STAFF: "法杖",
  WHISK: "拂塵",
  HIDDEN_WEAPON: "暗器",
  BOW: "手甲",
  GREAT_SWORD: "雙手刀",
  STING: "匕首",
  CLAW: "扇",
  PUNCHER: "手套",
  BOXING: "拳刃",
  SHIELD: "盾",
  HELMET: "帽",
  ARMOR: "衣",
  BOOT: "鞋",
  HORSE: "座騎",
  WING: "背飾",
  ORNAMENT: "飾品",
  POTION: "藥品",
  RETURN_SCROLL: "返回卷軸",
  ITEM_PET: "寵物",
  PET_ORNAMENT: "寵物飾品",
  BONUS: "禮包",
  MONEY: "金錢",
  NORMAL_ITEM: "一般道具",
  SCARCE_ITEM: "真元/魂石",
  EVENT_ITEM: "活動道具",
  ITEM_BOT: "機關人",
  CASTLE_ITEM: "家族道具",
};

export const itemTypeGroups: readonly TypeGroup[] = [
  {
    id: "weapon",
    label: "裝備 — 武器",
    types: [
      "SWORD",
      "BLADE",
      "STING",
      "BOXING",
      "PUNCHER",
      "STAFF",
      "CLAW",
      "GREAT_SWORD",
      "WHISK",
      "BOW",
      "ROD",
      "HAMMER",
      "HIDDEN_WEAPON",
      "SHIELD",
    ],
  },
  {
    id: "armor",
    label: "裝備 — 防具",
    types: ["HELMET", "ARMOR", "BOOT"],
  },
  {
    id: "special",
    label: "裝備 — 特殊",
    types: ["HORSE", "WING"],
  },
  {
    id: "accessory",
    label: "裝備 — 飾品",
    types: ["ORNAMENT"],
  },
  {
    id: "consumable",
    label: "消耗品",
    types: ["POTION", "RETURN_SCROLL"],
  },
  {
    id: "pet",
    label: "寵物",
    types: ["ITEM_PET", "PET_ORNAMENT"],
  },
  {
    id: "misc",
    label: "其他",
    types: [
      "BONUS",
      "MONEY",
      "NORMAL_ITEM",
      "SCARCE_ITEM",
      "EVENT_ITEM",
      "ITEM_BOT",
      "CASTLE_ITEM",
    ],
  },
] as const;

export const allItemTypes: readonly string[] = itemTypeGroups.flatMap((g) => g.types);

// 依 type 字串反查所屬群組
export function getGroupForType(type: string | null): TypeGroup | null {
  if (!type) return null;
  return itemTypeGroups.find((g) => g.types.includes(type)) ?? null;
}

// Item types eligible for Phase 2 scoring / ranking / comparison.
export const PHASE2_TYPES = ["HORSE", "WING"] as const;

export type Phase2Type = (typeof PHASE2_TYPES)[number];

export function isPhase2Type(value: unknown): value is Phase2Type {
  return typeof value === "string" && (PHASE2_TYPES as readonly string[]).includes(value);
}
