// 門派 (magic.clan / magic.clan2) → 中文對照
// 值域共 15 個 CLASS_* + null (生活/商業技能)
// 中文名暫依 TTHOL 常見對照，若遊戲內校對有差異只需改此表。

export const MAGIC_CLAN_LABELS: Record<string, string> = {
  CLASS_SHAULIN: "少林",
  CLASS_MONTO: "明教",
  CLASS_MONTO_KYLIN: "麒麟教",
  CLASS_SKY: "天音寺",
  CLASS_FLOWER: "花間派",
  CLASS_FOX: "唐門",
  CLASS_FOX_SNOW: "雪女",
  CLASS_FOX_NONE: "唐門 (無派)",
  CLASS_BAD: "五毒",
  CLASS_ISLE: "蓬萊",
  CLASS_GOD: "九玄",
  CLASS_MAGIC: "巫魔",
  CLASS_LOVE: "有情",
  CLASS_GUILD: "幫派",
  CLASS_CHILD: "童關",
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
