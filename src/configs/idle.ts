import type { AttributeKey } from "@/lib/types/stat-sim";

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

/** MVP 固定地圖：雷島南˙淺灘。 */
export const IDLE_STAGE_ID = 147;

/**
 * 可用技能的 func_dmg：傷害公式已確認的種類（damage.ts 的 EXACT_DMG 加 FITTED_DMG）。
 * 其餘種類（治療 11、猜測的 14、15…）不放進可選範圍。
 */
export const IDLE_SKILL_FUNC_DMG: readonly number[] = [3, 4, 6, 7, 8, 10, 17, 50];
/** 不是直接傷害的技能類型：5 毒術、6 醫療、8 機關術。 */
export const IDLE_EXCLUDED_SKILL_TYPES: readonly number[] = [5, 6, 8];

/**
 * 依門派自動配點的模板（POST /api/idle/auto-allocate）：
 *   1. 命中：點「技巧」直到對本地圖最高閃躲的命中率 ≥ TARGET_HIT_CHANCE %（以目前選用的技能計；沒有技能時以普攻計）。
 *   2. 其餘全部點主攻擊屬性：武器 / 技能吃物攻（面板 atk）→ 外功；吃內勁（matk，手套、掌法）→ 內力。
 * 不點體力、身法、玄學：怪物不反擊，這些在 MVP 沒有作用。
 * 主攻擊屬性由「實際使用的攻擊」決定，而不是只看門派（移花宮拿劍用外功、空手掌法用內力）。
 */
export const AUTO_ALLOCATE = {
  targetHitChance: 95,
  hitAttribute: "dex" as AttributeKey,
  mainAttribute: { atk: "str", matk: "pow" } as Record<"atk" | "matk", AttributeKey>,
};
