/**
 * 放置掛機 MVP 的常數。規格：docs/plans/2026-10-18-idle-game-mvp.md。
 * 時間單位一律是 tick（1/60 秒，與技能演出時間軸相同）。
 */

/** 遊戲速度倍率：遊戲 tick = 真實毫秒 / TICK_MS × GAME_SPEED。1 = 與原作同速。 */
export const GAME_SPEED = 1;
export const TICK_MS = 1000 / 60;

/** 找怪（走路）3 秒；之後換成依移動速度。 */
export const SEARCH_TICKS = 180;
/** 每次施放結束後的間隔 0.5 秒（怪物還活著才會再施放）。 */
export const POST_CAST_TICKS = 30;

/** 普攻（沒有可用技能時，Lv1..8 沒有任何門派技能可學）：沿用傷害試算的 DEFAULT_TIMING 700 ms。 */
export const NORMAL_ATTACK_TICKS = 42;
/** 普攻命中發生在施放中途。 */
export const NORMAL_ATTACK_HIT_TICK = 21;

/** 離線結算上限 12 小時。 */
export const OFFLINE_CAP_MS = 12 * 60 * 60 * 1000;
/** 瀏覽器呼叫 POST /api/idle/sync 的間隔。 */
export const SYNC_INTERVAL_MS = 30_000;

/**
 * 擊殺經驗的等級差：玩家等級 − 怪物等級 ≤ 這個值拿全額 drop_exp，超過就只拿 1。
 * 來源是使用者（玩家）回憶，伺服器端規則沒有實測；比怪低等也拿全額。
 */
export const EXP_LEVEL_GAP = 15;

/** MVP 固定地圖：雷島南˙淺灘。 */
export const IDLE_STAGE_ID = 147;

/** 入門弟子（clan bit 1）。新角色一律從這裡開始。 */
export const NOVICE_SECT_ID = 1;
/** 入門弟子・刀（男 / 女）：外觀用的預設角色。 */
export const NOVICE_PRESET_IDS = { m: 102, f: 103 } as const;
/** char.ini 給的起始武器 23004 新手用青銅刀；預設角色外觀拿的是 20001 青銅刀，數值以這把為準。 */
export const NOVICE_WEAPON_ID = 23004;
/** 角色名字：Big5 位元組數上限（ASCII 算 1，其他算 2）與不能出現的字元（tthol-emulator chargen 規則）。 */
export const NAME_MAX_BYTES = 15;
export const NAME_FORBIDDEN_CHARS = "~!@#$%^&*()=+|?/,'{}\"\\;";

/**
 * 入門弟子的生命、內力、護勁公式原作未實測；tthol-emulator 沿用移花宮那一列，這裡照做。
 * 物攻、命中等其餘面板與門派無關。
 */
export const NOVICE_PANEL_SECT_ID = 4;

/**
 * 可用技能的 func_dmg：傷害公式已確認的種類（damage.ts 的 EXACT_DMG 加 FITTED_DMG）。
 * 其餘種類（治療 11、猜測的 14、15…）不放進可選範圍。
 */
export const IDLE_SKILL_FUNC_DMG: readonly number[] = [3, 4, 6, 7, 8, 10, 17, 50];
/** 不是直接傷害的技能類型：5 毒術、6 醫療、8 機關術。 */
export const IDLE_EXCLUDED_SKILL_TYPES: readonly number[] = [5, 6, 8];

/** 入門弟子到這個等級自動獲得轉職證書，可以轉入下面三個門派之一（原作要先學完新手技能，v1 省略）。 */
export const JOB_CHANGE_LEVEL = 9;
/** 可轉入的門派：惡人谷 2、移花宮 4、天外天 8。 */
export const JOB_CHANGE_SECT_IDS = [2, 4, 8] as const;
export type JobChangeSectId = (typeof JOB_CHANGE_SECT_IDS)[number];
/**
 * 轉職後的武器流派：招式依右手武器決定（原作如此），所以每個門派有兩種新手武器可以切換。
 * 外觀用該流派的預設角色；空手外觀的預設角色（200 / 300…）沒有武器，武器由存檔的 weaponItemId 指定。
 * 第一個流派是轉職後的預設。
 */
export interface WeaponStyle {
  key: string;
  /** 招式系：「刀法」「詐招」… */
  label: string;
  weaponItemId: number;
  weaponName: string;
  /** 一般說法（「刀」「手套」），給提示句用。 */
  weaponShort: string;
  presetIds: { m: number; f: number };
  /** false = 先顯示但不能選（毒術要等引擎支援持續傷害）。 */
  enabled: boolean;
  /** 不能選時的簡短說明。 */
  note?: string;
}

export const WEAPON_STYLES: Record<JobChangeSectId, readonly WeaponStyle[]> = {
  2: [
    { key: "blade", label: "刀法", weaponItemId: 20001, weaponName: "青銅刀", weaponShort: "刀", presetIds: { m: 202, f: 203 }, enabled: true },
    { key: "trick", label: "詐招", weaponItemId: 20259, weaponName: "新手用手套", weaponShort: "手套", presetIds: { m: 200, f: 201 }, enabled: true },
  ],
  4: [
    { key: "sword", label: "劍法", weaponItemId: 20101, weaponName: "長劍", weaponShort: "劍", presetIds: { m: 304, f: 305 }, enabled: true },
    { key: "palm", label: "掌法", weaponItemId: 20259, weaponName: "新手用手套", weaponShort: "手套", presetIds: { m: 300, f: 301 }, enabled: true },
  ],
  8: [
    { key: "sting", label: "刺法", weaponItemId: 20301, weaponName: "匕首", weaponShort: "匕首", presetIds: { m: 406, f: 407 }, enabled: true },
    {
      key: "poison",
      label: "毒術",
      weaponItemId: 20259,
      weaponName: "手套／拂塵",
      weaponShort: "手套",
      presetIds: { m: 400, f: 401 },
      enabled: false,
      note: "毒術流派（手套／拂塵）之後開放",
    },
  ],
};
