export function levelToGenPrefix(level: number): string | null {
  if (level < 1) return null;
  if (level >= 200) return "200";
  if (level >= 180) return "180";
  if (level >= 160) return "160";
  if (level >= 140) return "140";
  if (level >= 120) return "120";
  if (level >= 100) return "100";
  if (level >= 80) return "80";
  if (level >= 60) return "60";
  if (level >= 40) return "40";
  return "20"; // 1~39
}

const ARMOR_TYPES = new Set(["鞋", "衣", "甲", "盾", "帽", "座騎"]);
const ACCESSORY_TYPES = new Set(["中飾", "左飾", "右飾", "背飾"]);
const ONE_HAND_WEAPONS = new Set([
  "劍",
  "刀",
  "匕首",
  "扇",
  "拂塵",
  "拳刃",
  "雙劍",
  "暗器",
  "棍",
]);

export function itemTypeToSlotPrefix(type: string | null): string | null {
  if (!type) return null;
  if (ARMOR_TYPES.has(type)) return type;
  if (ACCESSORY_TYPES.has(type)) return type;
  if (ONE_HAND_WEAPONS.has(type)) return "單手武器";
  if (type === "雙手刀") return "雙手武器";
  if (type === "法杖") return "法術武器";
  return null;
}
