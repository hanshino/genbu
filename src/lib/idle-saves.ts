// 放置掛機的存檔與結算：讀存檔 → 依時間重跑引擎 → 寫回。route handler 只負責驗證請求與回應格式。
// 全部是同步的 better-sqlite3 呼叫，每個操作包在一個 transaction 內（讀、結算、寫之間不會被別的請求插進來）。
import { NextResponse } from "next/server";
import { GAME_SPEED, OFFLINE_CAP_MS, SEARCH_TICKS, TICK_MS } from "@/configs/idle";
import { requireAuth } from "@/lib/auth/require-auth";
import { buildCombatant, presetProblem } from "@/lib/idle/character";
import { startAttributes, type NewCharacter } from "@/lib/idle/creation";
import { advance, resumeIfBlocked } from "@/lib/idle/engine";
import { skillOptions, type SkillChoice } from "@/lib/idle/skills";
import type { IdleData, IdleState, IdleSummary } from "@/lib/idle/types";
import { loadIdleData } from "@/lib/queries/idle";
import { levelPoints } from "@/lib/stat-sim";
import { getUserDb } from "@/lib/user-db";

export const IDLE_SAVE_VERSION = 1;

/** 真實毫秒 → 遊戲 ticks（無條件捨去，不會多給）。 */
export function msToTicks(ms: number): number {
  return Math.floor((Math.max(0, ms) * GAME_SPEED) / TICK_MS);
}

/** 遊戲 ticks → 真實毫秒（無條件進位，結算時間只會多扣、不會多給）。 */
export function ticksToMs(ticks: number): number {
  return Math.ceil((ticks * TICK_MS) / GAME_SPEED);
}

export function idleJson(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/** 請求內容必須是 JSON 物件；否則回傳 null。 */
export async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return typeof body === "object" && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** 寫入類 route 共用：same-origin + 登入檢查、解析 JSON 物件；失敗時直接回傳要回給瀏覽器的 response。 */
export async function authedBody(
  request: Request,
): Promise<{ sub: string; body: Record<string, unknown> } | NextResponse> {
  const session = await requireAuth(request);
  if (session instanceof NextResponse) {
    session.headers.set("Cache-Control", "no-store");
    return session;
  }
  const body = await readJsonObject(request);
  if (!body) return idleJson({ error: "請求格式不正確。" }, 400);
  return { sub: session.sub, body };
}

export function writeResponse(result: WriteResult): NextResponse {
  if (!result.ok) {
    return idleJson(result.state ? { error: result.error, state: result.state } : { error: result.error }, result.status);
  }
  return idleJson({ ...viewOf(result.state, result.data), summary: result.summary });
}

export function readSave(sub: string): IdleState | null {
  const row = getUserDb().prepare("SELECT state FROM idle_saves WHERE sub = ?").get(sub) as
    | { state: string }
    | undefined;
  return row ? (JSON.parse(row.state) as IdleState) : null;
}

function writeSave(sub: string, state: IdleState, now: number): void {
  getUserDb()
    .prepare(
      `INSERT INTO idle_saves (sub, version, state, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(sub) DO UPDATE SET version = excluded.version, state = excluded.state,
                                      updated_at = excluded.updated_at`,
    )
    .run(sub, IDLE_SAVE_VERSION, JSON.stringify(state), now);
}

/** 前端用的技能可選範圍（含預設）。 */
export function skillChoiceFor(state: IdleState, data: IdleData): SkillChoice {
  return skillOptions(data, state.level, buildCombatant(state, data));
}

export function viewOf(state: IdleState, data: IdleData) {
  const { options, defaultSkillId } = skillChoiceFor(state, data);
  return { state, options: { skills: options, defaultSkillId } };
}

function dataFor(state: IdleState): IdleData {
  const data = loadIdleData(state.stageId, state.presetId, state.weaponItemId);
  if (!data) throw new Error(`存檔的地圖或角色已不存在（stage ${state.stageId}, preset ${state.presetId}）`);
  return data;
}

/** 新存檔的角色資料；沒給就是六圍全 1、Lv1 的點數都還沒分配（測試與預設角色用）。 */
export type NewSaveInit = Partial<Pick<NewCharacter, "name" | "birthday" | "attributes" | "unspentPoints">>;

/** 新存檔：Lv1。seed 由呼叫端傳入（route 用 crypto）。 */
export function createState(data: IdleData, seed: number, now: number, init: NewSaveInit = {}): IdleState {
  const initial: IdleState = {
    ...(init.name !== undefined ? { name: init.name } : {}),
    ...(init.birthday ? { birthday: init.birthday } : {}),
    presetId: data.presetId,
    gender: data.gender,
    sectId: data.sectId,
    level: 1,
    exp: 0,
    money: 0,
    attributes: init.attributes ?? startAttributes(),
    unspentPoints: init.unspentPoints ?? levelPoints(1),
    skillId: null,
    skillLevel: 0,
    stageId: data.stageId,
    seed: seed >>> 0,
    saveCounter: 0,
    lastSettledAt: now,
    phase: { kind: "searching", remaining: SEARCH_TICKS },
    stats: { kills: 0, exp: 0, money: 0, hits: 0, misses: 0, damage: 0 },
  };
  return advance(initial, 0, data).state; // 補上 skillLevel
}

export type StartResult =
  | { ok: true; state: IdleState; data: IdleData }
  | { ok: false; status: number; error: string };

/**
 * 建立新存檔；已經有存檔時不覆蓋（回 409）。
 * data 的預設角色不在這裡檢查：route 只會傳入入門弟子，測試直接傳任何預設角色來準備存檔。
 */
export function startSave(sub: string, data: IdleData, seed: number, now: number, init: NewSaveInit = {}): StartResult {
  return getUserDb().transaction((): StartResult => {
    if (readSave(sub)) return { ok: false, status: 409, error: "已經有存檔了。" };
    const state = createState(data, seed, now, init);
    writeSave(sub, state, now);
    return { ok: true, state, data };
  })();
}

export interface Settled {
  state: IdleState;
  summary: IdleSummary;
}

/** 從 lastSettledAt 重跑到 now（上限 OFFLINE_CAP_MS），快轉不產生事件；超過上限的時間捨棄。 */
function settleToNow(state: IdleState, data: IdleData, now: number): Settled {
  const ticks = msToTicks(Math.min(now - state.lastSettledAt, OFFLINE_CAP_MS));
  const { state: next, summary } = advance(state, ticks, data);
  return { state: { ...next, lastSettledAt: Math.max(now, state.lastSettledAt) }, summary };
}

export type LoadResult =
  | { ok: true; state: null }
  | { ok: true; state: IdleState; data: IdleData; summary: IdleSummary };

/** GET /api/idle：有存檔就結算離線期間並寫回（saveCounter + 1，別的分頁的舊計數會被 409 擋下）。 */
export function loadAndSettle(sub: string, now: number): LoadResult {
  return getUserDb().transaction((): LoadResult => {
    const saved = readSave(sub);
    if (!saved) return { ok: true, state: null };
    const data = dataFor(saved);
    const settled = settleToNow(saved, data, now);
    const state = { ...settled.state, saveCounter: saved.saveCounter + 1 };
    writeSave(sub, state, now);
    return { ok: true, state, data, summary: settled.summary };
  })();
}

export type WriteResult =
  | { ok: true; state: IdleState; data: IdleData; summary: IdleSummary }
  | { ok: false; status: number; error: string; state?: IdleState };

const NO_SAVE: WriteResult = { ok: false, status: 404, error: "還沒有存檔，請先開始遊戲。" };
const STALE = "存檔已在別處更新，請重新載入。";

/**
 * POST /api/idle/sync：伺服器重跑 min(瀏覽器回報的 ticks, 距離上次結算實際經過的 ticks)。
 * lastSettledAt 只前進「實際重跑掉」的時間，瀏覽器少報的部分下次（含離線結算）仍會算進去。
 */
export function syncSave(sub: string, saveCounter: number, clientTicks: number, now: number): WriteResult {
  return getUserDb().transaction((): WriteResult => {
    const saved = readSave(sub);
    if (!saved) return NO_SAVE;
    if (saved.saveCounter !== saveCounter) return { ok: false, status: 409, error: STALE, state: saved };
    const data = dataFor(saved);
    // 超過上限的時間捨棄（與 GET 一致）；否則分次 sync 可以把 12 小時以前的時間一段一段領走。
    const from = Math.max(saved.lastSettledAt, now - OFFLINE_CAP_MS);
    const ticks = Math.min(clientTicks, msToTicks(now - from));
    const { state: next, summary } = advance(saved, ticks, data);
    const state = {
      ...next,
      lastSettledAt: Math.min(now, from + ticksToMs(ticks)),
      saveCounter: saved.saveCounter + 1,
    };
    writeSave(sub, state, now);
    return { ok: true, state, data, summary };
  })();
}

/**
 * 配點、換技能等會改變角色的操作：先結算到現在，再套用變更（擊殺率會跟著變），
 * 命中不足的暫停解除。change 回傳字串代表驗證失敗（不寫入）。
 */
export function changeSave(
  sub: string,
  saveCounter: number,
  now: number,
  change: (state: IdleState, data: IdleData) => Partial<IdleState> | string,
): WriteResult {
  return getUserDb().transaction((): WriteResult => {
    const saved = readSave(sub);
    if (!saved) return NO_SAVE;
    if (saved.saveCounter !== saveCounter) return { ok: false, status: 409, error: STALE, state: saved };
    const data = dataFor(saved);
    const settled = settleToNow(saved, data, now);
    const changed = change(settled.state, data);
    if (typeof changed === "string") return { ok: false, status: 400, error: changed };
    // 轉職、換武器會換預設角色或武器（外觀、技能）：之後的衍生欄位與回傳的資料都要用新的。
    // 變更之前的時間已經用舊角色結算掉了（上面的 settleToNow）。
    let nextData = data;
    const nextPreset = changed.presetId ?? saved.presetId;
    const nextWeapon = "weaponItemId" in changed ? changed.weaponItemId : saved.weaponItemId;
    if (nextPreset !== saved.presetId || nextWeapon !== saved.weaponItemId) {
      const loaded = loadIdleData(saved.stageId, nextPreset, nextWeapon);
      if (!loaded || presetProblem(loaded)) return { ok: false, status: 400, error: "找不到這個角色。" };
      nextData = loaded;
    }
    // 套用後重跑一次 0 tick 的 advance，讓 skillLevel 等衍生欄位跟上。
    const applied = advance(resumeIfBlocked({ ...settled.state, ...changed }), 0, nextData).state;
    const state = { ...applied, saveCounter: saved.saveCounter + 1 };
    writeSave(sub, state, now);
    return { ok: true, state, data: nextData, summary: settled.summary };
  })();
}
