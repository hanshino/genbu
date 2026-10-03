import type { SectId } from "@/lib/types/stat-sim";

/**
 * 傷害試算規則，全部來自 tthol_data `scripts/damage_capture_investigation.md` 的封包實測。
 * 計畫與每一項的驗證來源見 docs/plans/2026-10-03-stat-sim-damage.md。
 */

export type DamageSupport = "verified" | "presumed" | "unsupported";

export const SUPPORT_RANK: Record<DamageSupport, number> = { verified: 0, presumed: 1, unsupported: 2 };

export interface WeaponRule {
  support: Exclude<DamageSupport, "unsupported">;
  /** 面板上當 B 的攻擊值。 */
  attack: "atk" | "matk";
  /** 怪物身上扣的防禦。 */
  defense: "extraDef" | "magicDef";
  /** 武器傷害區間讀 items 的哪一欄。 */
  damageField: "damage" | "pdamage";
}

const PHYSICAL = { attack: "atk", defense: "extraDef", damageField: "damage" } as const;

/**
 * 劍（移花宮）、刀（羅煞刀）、倭刀（天外天普攻）、拳套（惡人谷，搗藥君 extra_def 96 / magic_def 126 分得出來）已實測。
 * 匕首、棍、雙劍只有 damage 欄，照劍算是合理推定，未實測。
 * 拂塵、杖、扇、拳刃部分兩欄都有值，不知道用哪一欄、打哪種防禦，不列在這裡。
 */
export const WEAPON_RULES: Record<string, WeaponRule> = {
  SWORD: { support: "verified", ...PHYSICAL },
  BLADE: { support: "verified", ...PHYSICAL },
  GREAT_SWORD: { support: "verified", ...PHYSICAL },
  PUNCHER: { support: "verified", attack: "matk", defense: "magicDef", damageField: "pdamage" },
  STING: { support: "presumed", ...PHYSICAL },
  ROD: { support: "presumed", ...PHYSICAL },
  HAMMER: { support: "presumed", ...PHYSICAL },
};

/** 空手普攻用物攻、沒有亂數（吹箭客 134 / 283 精確吻合）。 */
export const UNARMED_RULE: WeaponRule = { support: "verified", ...PHYSICAL };

/** 實測過的 func_dmg；其他類型（17、50、51…）完全沒有觀察。 */
export const VERIFIED_FUNC_DMG: readonly number[] = [3, 4, 6, 7, 8];

/** 詐招配拳套、劍法配劍實測過；刀、刺、倭刀、棍是物理武器招式，照普攻的 B / D 推定。 */
export const SKILL_TYPE_SUPPORT: Record<number, Exclude<DamageSupport, "unsupported">> = {
  2: "verified",
  3: "verified",
  1: "presumed",
  7: "presumed",
  10: "presumed",
  12: "presumed",
};

/** docs/game-setting-codes.md §4；18–20 是推斷名稱。 */
export const SKILL_TYPE_LABELS: Record<number, string> = {
  1: "刀法", 2: "詐招", 3: "劍法", 4: "拳腳", 5: "毒術", 6: "醫療", 7: "刺", 8: "機關術",
  9: "暗器", 10: "倭刀", 11: "忍術", 12: "棍法", 13: "拳套", 14: "氣／符陣", 16: "咒術",
  17: "拂塵", 18: "禁術", 19: "靈種", 20: "劍陣",
};

/** 主門派 → 技能的 magic.clan（跟被動用的 mainClan 不完全一樣，例如曼陀是 CLASS_MONTO）。 */
export const SECT_SKILL_CLANS: Record<SectId, readonly string[]> = {
  2: ["CLASS_BAD"],
  4: ["CLASS_FLOWER"],
  8: ["CLASS_SKY"],
  512: ["CLASS_FOX"],
  2048: ["CLASS_MONTO"],
  4096: ["CLASS_FOX_SNOW"],
  8192: ["CLASS_MONTO_KYLIN"],
};

/** K = 5 × 怪物等級 + 500，Lv22..101 擬合。 */
export const monsterK = (level: number): number => 5 * level + 500;

/** 實測過的怪最高 Lv101、防禦最高 308；超過就註記。 */
export const VERIFIED_MAX_MONSTER_LEVEL = 101;
export const VERIFIED_MAX_MONSTER_DEF = 310;
