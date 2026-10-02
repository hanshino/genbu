import { SECTS } from "@/configs/stat-sim";
import { ITEM_TYPE_LABELS } from "@/lib/constants/item-types";
import {
  STAT_KEYS,
  type AttributeKey,
  type EquipSlot,
  type PanelBonus,
  type PanelResult,
  type PanelStatKey,
  type SectId,
  type StatValue,
  type SubSectClan,
  type ValueRange,
} from "@/lib/types/stat-sim";

export type ViewKey = AttributeKey | PanelStatKey;

export const STAT_LABELS: Record<ViewKey | "weight", string> = {
  hp: "體力",
  mp: "真氣",
  str: "外功",
  pow: "內力",
  vit: "根骨",
  agi: "身法",
  dex: "技巧",
  wis: "玄學",
  atk: "物攻",
  matk: "內勁",
  def: "防禦",
  mdef: "護勁",
  hit: "命中",
  dodge: "閃躲",
  critical: "重擊",
  uncanny_dodge: "拆招",
  attack_speed: "攻速",
  run_speed: "移動",
  weight: "負重",
  weight_cap: "負重上限",
};

export const SECT_OPTIONS = Object.entries(SECTS).map(([id, sect]) => ({
  id: Number(id) as SectId,
  name: sect.name,
}));

export const SUB_SECT_LABELS: Record<SubSectClan, string> = {
  CLASS_GOD: "神武",
  CLASS_SHAULIN: "少林",
  CLASS_ISLE: "無名島",
  CLASS_MAGIC: "天師",
};

export const SLOT_LABELS: Record<EquipSlot, string> = {
  cap: "帽子",
  body: "衣服",
  foot: "鞋子",
  right: "右手",
  left: "左手",
  wing: "背部",
  horse: "坐騎",
  ornament1: "飾品一",
  ornament2: "飾品二",
  ornament3: "飾品三",
};

/** 小數字欄位：點進去就全選，可以直接覆蓋，也能再移動游標修改。 */
export const selectOnFocus = (e: { currentTarget: HTMLInputElement }) => e.currentTarget.select();

const nf = new Intl.NumberFormat("zh-TW");
export const fmt = (n: number) => nf.format(n);
export const signed = (n: number) => (n >= 0 ? `+${fmt(n)}` : `−${fmt(-n)}`);

export const typeLabel = (typeName: string | null) =>
  typeName ? (ITEM_TYPE_LABELS[typeName] ?? typeName) : "未知類型";

/** 「物攻 +70、內勁 +40」；空加成回傳空字串。 */
export function formatBonus(bonus: PanelBonus): string {
  return STAT_KEYS.filter((key) => bonus[key])
    .map((key) => `${STAT_LABELS[key]} ${signed(bonus[key]!)}`)
    .join("、");
}

/** 「50–85」；相連或重疊的區段合併，其餘用「、」分開。 */
export function formatRanges(ranges: ValueRange[]): string {
  const merged: ValueRange[] = [];
  for (const [a, b] of [...ranges].sort((x, y) => x[0] - y[0] || x[1] - y[1])) {
    const last = merged.at(-1);
    if (last && a <= last[1] + 1) last[1] = Math.max(last[1], b);
    else merged.push([a, b]);
  }
  return merged.map(([a, b]) => (a === b ? `${a}` : `${a}–${b}`)).join("、");
}

/** 最高可學等級：magic_learn.char_level ≤ 角色等級；缺學習資料（-1）的等級不算。 */
export function maxLearnable(learnLevels: number[], level: number): number {
  let best = 0;
  learnLevels.forEach((need, lv) => {
    if (lv > 0 && need !== -1 && need <= level) best = lv;
  });
  return best;
}

export const statOf = (panel: PanelResult, key: ViewKey): StatValue =>
  key in panel.attributes
    ? panel.attributes[key as keyof PanelResult["attributes"]]
    : panel.stats[key as keyof PanelResult["stats"]];
