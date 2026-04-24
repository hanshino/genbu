// 門派 (magic.clan / magic.clan2) → 中文對照
// 值域共 15 個 CLASS_* + null (生活/商業技能)
// 中文名暫依 TTHOL 常見對照，若遊戲內校對有差異只需改此表。

export const MAGIC_CLAN_LABELS: Record<string, string> = {
  CLASS_SHAULIN: "少林",
  CLASS_MONTO: "曼陀",
  CLASS_MONTO_KYLIN: "麒麟",
  CLASS_SKY: "天外天",
  CLASS_FLOWER: "移花宮",
  CLASS_FOX: "火狐",
  CLASS_FOX_SNOW: "雪狼",
  CLASS_FOX_NONE: "火狐 (無派)",
  CLASS_BAD: "惡人谷",
  CLASS_ISLE: "無名島",
  CLASS_GOD: "神武門",
  CLASS_MAGIC: "天師",
  CLASS_LOVE: "戀人",
  CLASS_GUILD: "家族",
  CLASS_CHILD: "入門弟子",
  CLASS_NONE: "無派系",
};

// 列表/篩選顯示順序（大派別在前）
export const MAGIC_CLAN_ORDER: readonly string[] = [
  "CLASS_SHAULIN",
  "CLASS_MONTO",
  "CLASS_MONTO_KYLIN",
  "CLASS_SKY",
  "CLASS_FLOWER",
  "CLASS_FOX",
  "CLASS_FOX_SNOW",
  "CLASS_FOX_NONE",
  "CLASS_BAD",
  "CLASS_ISLE",
  "CLASS_GOD",
  "CLASS_MAGIC",
  "CLASS_LOVE",
  "CLASS_GUILD",
  "CLASS_CHILD",
  "CLASS_NONE",
];

export function magicClanLabel(clan: string | null | undefined): string {
  if (!clan) return "生活/商業";
  return MAGIC_CLAN_LABELS[clan] ?? clan;
}

// 列表顯示用：clan 為 null 時會進一步看 skill_type 區分兩種語意。
// - clan != null                                → 門派中文名
// - clan == null && skill_type == null          → "生活/商業"（修練類、被動、生活商業技）
// - clan == null && skill_type != null          → "未分類"（原檔漏填門派的戰技，例如禪宗棍法）
export function magicClanListLabel(
  clan: string | null | undefined,
  skillType: number | null | undefined,
): { label: string; kind: "clan" | "general" | "unclassified" } {
  if (clan) {
    return { label: MAGIC_CLAN_LABELS[clan] ?? clan, kind: "clan" };
  }
  if (skillType == null) {
    return { label: "生活/商業", kind: "general" };
  }
  return { label: "未分類", kind: "unclassified" };
}
