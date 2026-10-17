import {
  JOB_CHANGE_LEVEL,
  JOB_CHANGE_SECT_IDS,
  NOVICE_SECT_ID,
  WEAPON_STYLES,
  type JobChangeSectId,
  type WeaponStyle,
} from "@/configs/idle";
import type { IdleState } from "./types";

/** 只看門派與等級的最小輸入，伺服器與瀏覽器共用（不碰 DB）。 */
type JobInput = Pick<IdleState, "sectId" | "level">;

/** 持有轉職證書 = 還是入門弟子且已到轉職等級；證書不另存在存檔裡。 */
export function canChangeJob(state: JobInput): boolean {
  return state.sectId === NOVICE_SECT_ID && state.level >= JOB_CHANGE_LEVEL;
}

export function isJobChangeSect(value: unknown): value is JobChangeSectId {
  return typeof value === "number" && (JOB_CHANGE_SECT_IDS as readonly number[]).includes(value);
}

/** GET /api/idle/jobs 回傳的一個門派（轉職視窗的一張卡）。 */
export interface JobChoice {
  sectId: JobChangeSectId;
  sectName: string;
  presetId: number;
  presetLabel: string;
  weaponName: string;
  /** 代表招式：武器能用的招中，可學等級最低的幾個。 */
  skills: { name: string; learnLevel: number }[];
  /** 這個門派的兩種武器流派（第一個是轉職後的預設）。 */
  styles: { key: string; label: string; weaponName: string; weaponShort: string; enabled: boolean }[];
  /** 待機動作的第一格（水平動畫條，第 0 格）；沒有動作圖為 null。 */
  sprite: { url: string; cellW: number; cellH: number; frames: number; anchorX: number; anchorY: number } | null;
}

/** 這個門派可切換的武器流派；入門弟子（或不認得的門派）回傳空陣列。 */
export function stylesFor(sectId: number): readonly WeaponStyle[] {
  return isJobChangeSect(sectId) ? WEAPON_STYLES[sectId] : [];
}

/** 資料端點用：這個（門派、預設角色、武器）是不是某個武器流派的組合。 */
export function isStyleWeapon(sectId: number, presetId: number, weaponItemId: number): boolean {
  return stylesFor(sectId).some(
    (style) => style.weaponItemId === weaponItemId && (style.presetIds.m === presetId || style.presetIds.f === presetId),
  );
}

/** 該性別的預設角色 id 與武器對應到哪個流派（存檔裡的 presetId 就能分辨，兩個流派的外觀不同）。 */
export function currentStyle(state: Pick<IdleState, "sectId" | "presetId" | "gender">): WeaponStyle | null {
  return stylesFor(state.sectId).find((style) => style.presetIds[state.gender] === state.presetId) ?? null;
}
