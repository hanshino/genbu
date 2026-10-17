/**
 * 普通攻擊的攻速等級與揮擊週期，照客戶端的算法（tthol-data 靜態讀 0x4213b0，2026-10-10；
 * 實測空手 身法 8→7、37→8、78→10、144→12、186→14）。資料與公式來源：tthol-emulator
 * `server/attack_speed.py`、`data/attack_speed.csv`（客戶端 attack_speed.ini：右手武器類型 × 門派）。
 *
 *   v     = attack_speed.ini[右手武器類型][門派]
 *   s     = v + ⌊(250 − v) × 身法 / 250⌋
 *   等級  = 階梯 (0, 150, 157, …, 230) 中 ≤ s 的個數 + 裝備的 attack_speed，限制在 1..14
 *   週期  = 3 × (17 − 等級) × 0.48 / 27 秒
 *
 * 這份表與 stat-sim 的 ATTACK_SPEED_TABLE（只收文件 §4 已記載的值）不同，刻意分開：
 * stat-sim 的攻速目前用 7 + ⌊身法 / 25⌋ 的近似，並把非 185 的武器標成估計。
 */

/** 客戶端的攻速階梯（0x5fc110）。 */
export const ATTACK_SPEED_STEPS = [
  0, 150, 157, 163, 170, 177, 183, 190, 197, 203, 210, 217, 223, 230,
] as const;
export const MAX_ATTACK_SPEED_LEVEL = ATTACK_SPEED_STEPS.length;

/** 沒有武器（空手）。 */
export const UNARMED_TYPE = "UNARMED";

/** 一個武器類型的基礎值：預設值，加上個別門派（bit）的例外。 */
interface AttackSpeedRow {
  base: number;
  sects?: Readonly<Record<number, number>>;
}

const MID_SECTS = { 256: 175, 512: 175, 1024: 175, 2048: 175, 4096: 175, 8192: 175 } as const;

/** attack_speed.csv（weapon_type × sect_bit）；門派 bit：1 入門弟子、2 惡人谷、4 移花宮、8 天外天… */
export const ATTACK_SPEED_INI: Readonly<Record<string, AttackSpeedRow>> = {
  [UNARMED_TYPE]: { base: 185 },
  SWORD: { base: 175, sects: { 4: 180 } },
  BLADE: { base: 170, sects: { 2: 175 } },
  ROD: { base: 170 },
  GREAT_SWORD: { base: 175 },
  PUNCHER: { base: 150 },
  HIDDEN_WEAPON: { base: 160 },
  STING: { base: 180, sects: { 8: 185 } },
  BOXING: { base: 180 },
  CLAW: { base: 180 },
  SPEAR: { base: 170 },
  WHISK: { base: 180 },
  STAFF: { base: 165, sects: MID_SECTS },
  BOW: { base: 170, sects: { 64: 185 } },
  HAMMER: { base: 165, sects: MID_SECTS },
};

/** 表裡找不到（盾、斧…）回傳 null。weaponType 為 null = 空手。 */
export function attackSpeedBase(weaponType: string | null, sectBit: number): number | null {
  const row = ATTACK_SPEED_INI[weaponType ?? UNARMED_TYPE];
  if (!row) return null;
  return row.sects?.[sectBit] ?? row.base;
}

/**
 * 攻速等級 1..14。agility 是面板的身法（含裝備）；extra 是裝備的 attack_speed 加成。
 * 武器類型不在表裡時，客戶端不會更新等級；這裡退回空手的值，讓結果仍然是確定的數字。
 */
export function attackSpeedLevel(
  weaponType: string | null,
  sectBit: number,
  agility: number,
  extra = 0,
): number {
  const v = attackSpeedBase(weaponType, sectBit) ?? ATTACK_SPEED_INI[UNARMED_TYPE].base;
  const s = v + Math.floor(((250 - v) * Math.max(0, Math.floor(agility))) / 250);
  const steps = ATTACK_SPEED_STEPS.filter((t) => t <= s).length;
  return Math.max(1, Math.min(MAX_ATTACK_SPEED_LEVEL, steps + extra));
}

/** 揮擊週期（秒）：3 格、每格 17 − 等級 個單位，一個單位 0.48 / 27 秒。Lv1 約 0.85 秒、Lv14 約 0.16 秒。 */
export function swingPeriodSeconds(level: number): number {
  return (3 * (17 - level) * 0.48) / 27;
}

/** 引擎用的 tick（1/60 秒）：3 × (17 − Lv) × 0.48 / 27 × 60 = (17 − Lv) × 16 / 5，四捨五入成整數。 */
export const MIN_SWING_TICKS = 6;
export function swingTicks(level: number): number {
  return Math.max(MIN_SWING_TICKS, Math.round(((17 - level) * 16) / 5));
}

/**
 * 命中落在揮擊的 2/3：基本揮擊是 4 格、每格 d = 17 − 等級，命中（封包 14）在第 2d、下一次揮擊在 3d
 * （tthol.gamedata.attack_speed 的說明）。
 */
export function swingHitTick(castTicks: number): number {
  return Math.max(1, Math.round((castTicks * 2) / 3));
}
