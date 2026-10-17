// 放置掛機畫面用的純函式（不碰 DOM、不碰 DB）：每小時擊倒數、事件 → 紀錄文字、場景的暫態動畫、離線摘要文字。
import {
  GAME_SPEED,
  NORMAL_ATTACK_TICKS,
  OFFLINE_CAP_MS,
  POST_CAST_TICKS,
  SEARCH_TICKS,
  TICK_MS,
} from "@/configs/idle";
import { expectedDamage, hitChance, type Attacker } from "@/lib/combat/damage";
import { advance } from "./engine";
import { monsterTarget } from "./skills";
import type { IdleData, IdleEvent, IdleMonster, IdleSkillLevel, IdleState, IdleSummary } from "./types";

/** 遊戲 ticks → 真實毫秒（只給畫面用；存檔結算用 idle-saves 的版本）。 */
export function ticksToMs(ticks: number): number {
  return (ticks * TICK_MS) / GAME_SPEED;
}

// ---------------------------------------------------------------------------
// 每小時擊倒數
// ---------------------------------------------------------------------------

export const KILL_RATE_WINDOW_MS = 10 * 60_000;
/** 觀察時間不到這麼久、或樣本太少時不顯示，避免開局忽高忽低。 */
export const KILL_RATE_MIN_SPAN_MS = 20_000;

/**
 * 由最近的擊倒時間（毫秒時間戳）推算每小時擊倒數。
 * 觀察區間 = min(視窗, 現在 − 開始觀察的時間)；區間太短或不足 2 隻時回傳 null。
 */
export function killsPerHour(
  killTimes: readonly number[],
  now: number,
  startedAt: number,
  windowMs: number = KILL_RATE_WINDOW_MS,
): number | null {
  const span = Math.min(windowMs, now - startedAt);
  if (span < KILL_RATE_MIN_SPAN_MS) return null;
  const recent = killTimes.filter((t) => t > now - span && t <= now).length;
  if (recent < 2) return null;
  return Math.round((recent / span) * 3_600_000);
}

/** 開局還沒有足夠樣本時，用離線結算的擊倒速度當預估；沒有資料回傳 null。 */
export function killRateFromSummary(summary: Pick<IdleSummary, "ticks" | "kills">): number | null {
  const ms = ticksToMs(summary.ticks);
  if (summary.kills <= 0 || ms < KILL_RATE_MIN_SPAN_MS) return null;
  return Math.round((summary.kills / ms) * 3_600_000);
}

// ---------------------------------------------------------------------------
// 命中率與擊倒時間預估（角色分頁、技能分頁）
// ---------------------------------------------------------------------------

export interface KillEstimate {
  /** 命中率 %（0..100）。 */
  hitPct: number;
  /** 找怪加施放的平均秒數；命中率 0（卡住）時為 null。 */
  seconds: number | null;
}

/**
 * 對一種怪「平均多久擊倒一隻」：找怪 + 期望施放次數 × 施放時長 + 施放後間隔。
 * 次數 = 怪物 HP / 一次施放的期望傷害（含 miss、多段）。是估計，不是引擎的結果。
 * skill 為 null 代表普攻。
 */
export function killEstimate(attacker: Attacker, monster: IdleMonster, skill: IdleSkillLevel | null): KillEstimate {
  const target = monsterTarget(monster);
  const hitPct = hitChance(attacker, target, skill);
  const expected = expectedDamage(attacker, target, skill);
  if (hitPct <= 0 || expected <= 0) return { hitPct, seconds: null };
  const casts = Math.max(1, monster.hp / expected);
  const castTicks = skill ? skill.castTicks : NORMAL_ATTACK_TICKS;
  const ticks = SEARCH_TICKS + casts * castTicks + (casts - 1) * POST_CAST_TICKS;
  return { hitPct, seconds: ticksToMs(ticks) / 1000 };
}

// ---------------------------------------------------------------------------
// 戰鬥紀錄
// ---------------------------------------------------------------------------

export interface LogContext {
  monsterName: string;
  skillName: string;
}

export interface LogLine {
  text: string;
  gain: string;
}

const nf = new Intl.NumberFormat("zh-TW");
export const formatNumber = (n: number): string => nf.format(n);

export const NORMAL_ATTACK_NAME = "普通攻擊";

/** 事件 → 紀錄一行；不值得記的（找怪、施放、一般命中）回傳 null。 */
export function describeEvent(event: IdleEvent, ctx: LogContext): LogLine | null {
  switch (event.type) {
    case "encounter":
      return { text: `遇到 ${ctx.monsterName}`, gain: "" };
    case "hit":
      return event.kind === "crit"
        ? { text: `${ctx.skillName}重擊 ${ctx.monsterName}`, gain: `${formatNumber(event.damage)} 傷害` }
        : null;
    case "miss":
      return { text: `${ctx.skillName}未命中 ${ctx.monsterName}`, gain: "" };
    case "kill":
      return {
        text: `擊倒 ${ctx.monsterName}`,
        gain: `+${formatNumber(event.exp)} 經驗　+${formatNumber(event.money)} 金錢`,
      };
    case "level-up":
      return { text: `升到 Lv.${event.level}，獲得屬性點`, gain: `+${event.points} 點` };
    case "hit-too-low":
      return { text: `命中不足，需要命中 ${formatNumber(event.required)}`, gain: "" };
    default:
      return null;
  }
}

/** 紀錄用的目前怪物與招式名：讀進一個事件，回傳更新後的 context。 */
export function nextLogContext(prev: LogContext, event: IdleEvent, data: IdleData): LogContext {
  if (event.type === "encounter") return { ...prev, monsterName: data.monsters[event.monsterId]?.name ?? "怪物" };
  if (event.type === "cast") {
    const name =
      event.skillId == null ? NORMAL_ATTACK_NAME : (data.skills.find((s) => s.id === event.skillId)?.name ?? "招式");
    return { ...prev, skillName: name };
  }
  return prev;
}

export const LOG_LIMIT = 50;

export function formatClock(ms: number): string {
  const d = new Date(ms);
  const two = (n: number) => String(n).padStart(2, "0");
  return `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`;
}

// ---------------------------------------------------------------------------
// 場景：位置由 state.phase 推導；只有「打到誰、什麼時候打到」這類暫態靠事件。
// ---------------------------------------------------------------------------

/** 擊倒後屍體留在場上的 ticks（接著淡出）。 */
export const CORPSE_TICKS = 45;
/** 傷害數字在場上停留的 ticks（與技能演出頁一致）。 */
export const POPUP_TICKS = 45;

export interface Popup {
  at: number;
  kind: "hit" | "crit" | "miss";
  damage: number;
}

export interface SceneFx {
  /** 目前打的怪；null = 從 state.phase 推。 */
  monsterId: number | null;
  /** 這隻怪每次受傷的場景時間（ticks），受擊動畫與倒地用。 */
  hurts: number[];
  killAt: number | null;
  /** 屍體消失的場景時間。 */
  goneAt: number | null;
  popups: Popup[];
}

export function newFx(): SceneFx {
  return { monsterId: null, hurts: [], killAt: null, goneAt: null, popups: [] };
}

/** base = 這批事件所屬的 advance 開始時的場景時間；事件的 t 是相對位移。 */
export function applyEvents(fx: SceneFx, events: readonly IdleEvent[], base: number): void {
  for (const e of events) {
    const at = base + e.t;
    if (e.type === "encounter") {
      fx.monsterId = e.monsterId;
      fx.hurts = [];
      fx.killAt = null;
      fx.goneAt = null;
      fx.popups = [];
    } else if (e.type === "hit") {
      fx.hurts.push(at);
      fx.popups.push({ at, kind: e.kind, damage: e.damage });
    } else if (e.type === "miss") {
      fx.popups.push({ at, kind: "miss", damage: 0 });
    } else if (e.type === "kill") {
      fx.killAt = at;
    } else if (e.type === "search-start") {
      fx.goneAt = at + CORPSE_TICKS;
    }
  }
  const last = events.length ? base + events[events.length - 1].t : base;
  fx.popups = fx.popups.filter((p) => last - p.at <= POPUP_TICKS + 30);
}

/** 目前（或剛打完）的怪：找怪中看事件記錄（屍體），其餘看 phase。 */
export function currentMonsterId(state: IdleState, fx: SceneFx): number | null {
  const phase = state.phase;
  return phase.kind === "searching" ? fx.monsterId : phase.monsterId;
}

/** 找怪結束時會遇到哪隻（引擎在找怪結束那一刻才抽，這裡複製一份狀態往前跑）；以 seed 記憶。 */
let peeked: { seed: number; monsterId: number | null } | null = null;
export function peekEncounter(state: IdleState, data: IdleData): number | null {
  if (state.phase.kind !== "searching") return null;
  if (peeked && peeked.seed === state.seed) return peeked.monsterId;
  const { events } = advance(state, state.phase.remaining, data, { collectEvents: true });
  const hit = events.find((e) => e.type === "encounter");
  peeked = { seed: state.seed, monsterId: hit && hit.type === "encounter" ? hit.monsterId : null };
  return peeked.monsterId;
}

/**
 * 背景捲動用的「已走完幾次找怪」（含目前這次的進度，小數）。只由存檔推導，不用額外計時：
 * 找怪中 = kills + 進度；正在打的怪還活著 = kills + 1；剛擊倒（kills 已經 +1）= kills。
 */
export function searchesCompleted(state: IdleState): number {
  const phase = state.phase;
  const kills = state.stats.kills;
  if (phase.kind === "searching") return kills + (SEARCH_TICKS - phase.remaining) / SEARCH_TICKS;
  if (phase.kind === "casting" || phase.kind === "post-cast") return phase.hp > 0 ? kills + 1 : kills;
  return kills + 1;
}

// ---------------------------------------------------------------------------
// 離線摘要
// ---------------------------------------------------------------------------

export const OFFLINE_MIN_MS = 60_000;

/** 離開不到一分鐘、或什麼事都沒發生，不打擾。 */
export function offlineWorthShowing(summary: IdleSummary): boolean {
  return ticksToMs(summary.ticks) >= OFFLINE_MIN_MS && (summary.kills > 0 || summary.blocked);
}

export function formatOfflineDuration(summary: Pick<IdleSummary, "ticks">): { text: string; capped: boolean } {
  const ms = ticksToMs(summary.ticks);
  const capped = ms >= OFFLINE_CAP_MS - 1000;
  const minutes = Math.max(1, Math.round(ms / 60_000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const text = hours === 0 ? `${minutes} 分鐘` : rest === 0 ? `${hours} 小時` : `${hours} 小時 ${rest} 分`;
  return { text, capped };
}
