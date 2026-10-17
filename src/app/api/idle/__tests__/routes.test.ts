// @vitest-environment node
import { afterAll, beforeAll, beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { OFFLINE_CAP_MS } from "@/configs/idle";
import { levelPoints } from "@/lib/stat-sim";
import { makeState } from "@/lib/idle/__tests__/fixtures";
import { msToTicks, startSave as writeNewSave } from "@/lib/idle-saves";
import { loadIdleData } from "@/lib/queries/idle";
import { getUserDb } from "@/lib/user-db";
import type { IdleState } from "@/lib/idle/types";

// requireAuth / getSession 會讀 cookie 與 origin，這裡換成可控的登入身分。
let sub: string | null = "U_idle";
vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: async () => (sub ? { sub } : NextResponse.json({ error: "登入已過期，請重新登入。" }, { status: 400 })),
}));
vi.mock("@/lib/auth/session", () => ({
  getSession: async () => (sub ? { sub } : null),
}));

import { GET } from "../route";
import { POST as start } from "../start/route";
import { POST as sync } from "../sync/route";
import { POST as allocate } from "../allocate/route";
import { POST as skill } from "../skill/route";
import { POST as jobChange } from "../job-change/route";
import { GET as jobs } from "../jobs/route";
import { POST as weapon } from "../weapon/route";
import { GET as idleData } from "../data/route";

const dir = mkdtempSync(join(tmpdir(), "genbu-idle-routes-"));
const file = join(dir, "user.sqlite");
const original = process.env.GENBU_USER_DB_PATH;
const T0 = Date.UTC(2026, 9, 18, 12, 0, 0);

const SWORD = 304; // 移花宮・劍（男）
const forgetCachedConnection = () => delete (globalThis as { _userDb?: Database.Database })._userDb;

const post = (handler: (r: Request) => Promise<Response>, body: unknown) =>
  handler(new Request("http://localhost/api/idle/x", { method: "POST", body: JSON.stringify(body) }));

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const read = async (res: Response): Promise<Json> => (await res.json()) as Json;

/**
 * 直接準備某個預設角色的 Lv1 存檔（走 idle-saves 的寫入函式）。
 * POST /api/idle/start 只會建立入門弟子，其他門派的測試靠這個開局。
 */
function seedSave(presetId: number, owner: string | null = sub): IdleState {
  const data = loadIdleData(147, presetId);
  if (!data || !owner) throw new Error(`無法準備預設角色 ${presetId} 的存檔`);
  const result = writeNewSave(owner, data, 12345, Date.now());
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

/** 直接寫存檔，用來準備高等級或命中不足這種開局狀態。 */
function putState(state: IdleState) {
  getUserDb()
    .prepare("INSERT OR REPLACE INTO idle_saves (sub, version, state, updated_at) VALUES (?, 1, ?, ?)")
    .run(sub, JSON.stringify(state), T0);
}

beforeAll(() => {
  process.env.GENBU_USER_DB_PATH = file;
  forgetCachedConnection();
});

afterAll(() => {
  getUserDb().close();
  forgetCachedConnection();
  if (original == null) delete process.env.GENBU_USER_DB_PATH;
  else process.env.GENBU_USER_DB_PATH = original;
  rmSync(dir, { recursive: true, force: true });
});

beforeEach(() => {
  sub = "U_idle";
  getUserDb().prepare("DELETE FROM idle_saves").run();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("idle_saves 資料表", () => {
  it("用 CREATE TABLE IF NOT EXISTS 建立", () => {
    const columns = (getUserDb().pragma("table_info(idle_saves)") as { name: string }[]).map((c) => c.name);
    expect(columns).toEqual(["sub", "version", "state", "updated_at"]);
  });
});

describe("GET /api/idle", () => {
  it("沒登入 401，沒存檔回 state: null；全部 no-store", async () => {
    sub = null;
    const denied = await GET();
    expect(denied.status).toBe(401);
    expect(denied.headers.get("Cache-Control")).toBe("no-store");
    sub = "U_idle";
    const empty = await GET();
    expect(empty.headers.get("Cache-Control")).toBe("no-store");
    expect(await read(empty)).toEqual({ state: null });
  });

  it("離線結算：依 now − lastSettledAt 重跑並寫回，回傳摘要與技能選項", async () => {
    seedSave(SWORD);
    vi.setSystemTime(T0 + 3600_000);
    const body = await read(await GET());
    expect(body.offlineSummary.ticks).toBe(msToTicks(3600_000));
    expect(body.offlineSummary.kills).toBeGreaterThan(0);
    expect(body.state.stats.kills).toBe(body.offlineSummary.kills);
    expect(body.state.lastSettledAt).toBe(T0 + 3600_000);
    expect(body.state.saveCounter).toBe(1);
    expect(body.options).toHaveProperty("skills");
    // 再讀一次：同一時間不再有離線時間。
    const again = await read(await GET());
    expect(again.offlineSummary.ticks).toBe(0);
    expect(again.state.stats.kills).toBe(body.state.stats.kills);
  });

  it("離線結算上限 12 小時", async () => {
    seedSave(SWORD);
    vi.setSystemTime(T0 + 48 * 3600_000);
    const body = await read(await GET());
    expect(body.offlineSummary.ticks).toBe(msToTicks(OFFLINE_CAP_MS));
  });
});

describe("POST /api/idle/start", () => {
  const body = (over: Record<string, unknown> = {}) => ({
    name: "江湖",
    gender: "m",
    attributes: { str: 1, pow: 1, vit: 1, agi: 1, dex: 1, wis: 1 },
    ...over,
  });

  it("建立入門弟子・刀（男）：Lv1、名字、屬性與剩餘點數照請求、seed 來自 crypto", async () => {
    const res = await post(start, body({ attributes: { str: 3, pow: 1, vit: 1, agi: 1, dex: 4, wis: 1 }, birthday: { month: 3, day: 14 } }));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const json = await read(res);
    expect(json.state).toMatchObject({
      name: "江湖",
      birthday: { month: 3, day: 14 },
      presetId: 102,
      gender: "m",
      sectId: 1,
      level: 1,
      exp: 0,
      money: 0,
      attributes: { str: 3, pow: 1, vit: 1, agi: 1, dex: 4, wis: 1 },
      unspentPoints: levelPoints(1) - 5,
      skillId: null,
      stageId: 147,
      saveCounter: 0,
      lastSettledAt: T0,
      phase: { kind: "searching" },
    });
    expect(json.state.weaponItemId).toBeUndefined(); // 入門弟子的武器由資料層固定為 23004
    expect(Number.isInteger(json.state.seed)).toBe(true);
    expect(json.options.skills).toEqual([]);
    // 存進資料庫的內容與回應一致。
    const stored = JSON.parse(
      (getUserDb().prepare("SELECT state FROM idle_saves WHERE sub = ?").get(sub) as { state: string }).state,
    ) as IdleState;
    expect(stored).toEqual(json.state);
  });

  it("女性用 103；沒填生日就沒有 birthday；名字頭尾空白會去掉；點數可以不用完", async () => {
    const json = await read(await post(start, body({ gender: "f", name: "  Lily ", birthday: null })));
    expect(json.state).toMatchObject({ presetId: 103, gender: "f", sectId: 1, name: "Lily", unspentPoints: levelPoints(1) });
    expect("birthday" in json.state).toBe(false);
  });

  it("兩個存檔的種子不同", async () => {
    const a = await read(await post(start, body()));
    sub = "U_other";
    const b = await read(await post(start, body()));
    expect(a.state.seed).not.toBe(b.state.seed);
    getUserDb().prepare("DELETE FROM idle_saves WHERE sub = 'U_other'").run();
  });

  it("已經有存檔回 409，原本的存檔不變", async () => {
    const first = await read(await post(start, body()));
    const second = await post(start, body({ name: "另一個人", gender: "f" }));
    expect(second.status).toBe(409);
    expect((await read(second)).error).toBe("已經有存檔了。");
    const stored = JSON.parse(
      (getUserDb().prepare("SELECT state FROM idle_saves WHERE sub = ?").get(sub) as { state: string }).state,
    ) as IdleState;
    expect(stored).toEqual(first.state);
  });

  it.each([
    ["空的名字", { name: "" }, "請輸入名字。"],
    ["純空白的名字", { name: "   " }, "請輸入名字。"],
    ["沒有名字", { name: undefined }, "請輸入名字。"],
    ["超過 15 位元組", { name: "江".repeat(8) }, "名字最長 15 位元組（英數字算 1、中文字算 2），目前 16。"],
    ["禁用符號 ;", { name: "a;b" }, "名字不能包含「;」。"],
    ["禁用符號 反斜線", { name: "a\\b" }, "名字不能包含「\\」。"],
    ["含 GM（不分大小寫）", { name: "小gM" }, "名字不能包含「GM」。"],
    ["Big5 沒有的字元", { name: "劍😀" }, "遊戲不支援「😀」這個字元。"],
    ["屬性點超過 6 點", { attributes: { str: 8, pow: 1, vit: 1, agi: 1, dex: 1, wis: 1 } }, "屬性點最多只能用 6 點。"],
    ["屬性分散後仍超過", { attributes: { str: 4, pow: 4, vit: 1, agi: 1, dex: 1, wis: 2 } }, "屬性點最多只能用 6 點。"],
    ["屬性低於 1", { attributes: { str: 0, pow: 1, vit: 1, agi: 1, dex: 1, wis: 1 } }, "屬性不能低於 1。"],
    ["屬性是負數（想用負數換出點數）", { attributes: { str: -5, pow: 12, vit: 1, agi: 1, dex: 1, wis: 1 } }, "屬性不能低於 1。"],
    ["屬性不是整數", { attributes: { str: 1.5, pow: 1, vit: 1, agi: 1, dex: 1, wis: 1 } }, "屬性必須是整數。"],
    ["少一項屬性", { attributes: { str: 1, pow: 1, vit: 1, agi: 1, dex: 1 } }, "請提供六項屬性。"],
    ["性別不是 m / f", { gender: "x" }, "請選擇性別。"],
    ["沒有性別", { gender: undefined }, "請選擇性別。"],
    ["生日月份不對", { birthday: { month: 13, day: 1 } }, "生日的月份要在 1 到 12 之間。"],
    ["生日日期不對", { birthday: { month: 2, day: 30 } }, "2 月沒有 30 日。"],
    ["生日格式不對", { birthday: { month: "2", day: 3 } }, "生日格式不正確。"],
  ])("拒絕：%s", async (_label, over, error) => {
    const res = await post(start, body(over));
    expect(res.status).toBe(400);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect((await read(res)).error).toBe(error);
    // 被拒絕就不建立存檔。
    expect(await read(await GET())).toEqual({ state: null });
  });

  it("不能再用 presetId 指定角色：舊的請求格式一律被拒絕", async () => {
    for (const presetId of [102, 304, 1220]) {
      const res = await post(start, { presetId });
      expect(res.status).toBe(400);
      expect((await read(res)).error).toBe("請選擇性別。");
    }
    // 帶著合法欄位也一樣：presetId 被忽略，只會建立入門弟子。
    const json = await read(await post(start, body({ presetId: 304 })));
    expect(json.state).toMatchObject({ presetId: 102, sectId: 1 });
  });

  it("沒登入時回 requireAuth 的錯誤，且 no-store；不會建立存檔", async () => {
    sub = null;
    const res = await post(start, body());
    expect(res.status).toBe(400);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect((await read(res)).error).toBe("登入已過期，請重新登入。");
    sub = "U_idle";
    expect(await read(await GET())).toEqual({ state: null });
  });

  it("請求不是 JSON 物件", async () => {
    const res = await start(new Request("http://localhost", { method: "POST", body: "nope" }));
    expect(res.status).toBe(400);
    expect((await read(res)).error).toBe("請求格式不正確。");
  });
});

describe("POST /api/idle/sync", () => {
  it("伺服器 ticks = min(瀏覽器回報, 實際經過)：回報太多被壓低，回報較少照回報", async () => {
    const s0 = seedSave(SWORD);
    vi.setSystemTime(T0 + 10_000);
    const over = await read(await post(sync, { saveCounter: s0.saveCounter, clientTicks: 10_000_000 }));
    expect(over.summary.ticks).toBe(msToTicks(10_000));
    expect(over.state.saveCounter).toBe(1);
    expect(over.state.lastSettledAt).toBe(T0 + 10_000);

    vi.setSystemTime(T0 + 60_000);
    const under = await read(await post(sync, { saveCounter: 1, clientTicks: 100 }));
    expect(under.summary.ticks).toBe(100);
    expect(under.state.saveCounter).toBe(2);
    // 沒用掉的時間留給下次，不會被吃掉。
    expect(under.state.lastSettledAt).toBeLessThan(T0 + 60_000);
    expect(under.state.lastSettledAt).toBeGreaterThanOrEqual(T0 + 10_000 + 1666);
  });

  it("離線超過 12 小時：sync 一次領完上限，不能分次領走更早的時間", async () => {
    const s0 = seedSave(SWORD);
    const now = T0 + 48 * 3600_000;
    vi.setSystemTime(now);
    const first = await read(await post(sync, { saveCounter: s0.saveCounter, clientTicks: 1_000_000_000 }));
    expect(first.summary.ticks).toBe(msToTicks(OFFLINE_CAP_MS));
    expect(first.state.lastSettledAt).toBe(now);
    const second = await read(await post(sync, { saveCounter: 1, clientTicks: 1_000_000_000 }));
    expect(second.summary.ticks).toBe(0);
  });

  it("結果與直接重跑引擎相同（瀏覽器只送時間、不送結果）", async () => {
    const s0 = seedSave(SWORD);
    vi.setSystemTime(T0 + 600_000);
    const body = await read(await post(sync, { saveCounter: s0.saveCounter, clientTicks: msToTicks(600_000) }));
    const { advance } = await import("@/lib/idle/engine");
    const { loadIdleData } = await import("@/lib/queries/idle");
    const expected = advance(s0, msToTicks(600_000), loadIdleData(147, SWORD)!);
    expect(body.state.stats).toEqual(expected.state.stats);
    expect(body.state.seed).toBe(expected.state.seed);
    expect(body.state.level).toBe(expected.state.level);
  });

  it("saveCounter 不符回 409，帶目前的存檔且不推進", async () => {
    const s0 = seedSave(SWORD);
    vi.setSystemTime(T0 + 10_000);
    const res = await post(sync, { saveCounter: s0.saveCounter + 5, clientTicks: 600 });
    expect(res.status).toBe(409);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = await read(res);
    expect(body.error).toContain("重新載入");
    expect(body.state).toEqual(s0);
    const stored = await read(await GET());
    expect(stored.state.saveCounter).toBe(s0.saveCounter + 1); // 這次 GET 才 + 1，前面的 409 沒有寫入
  });

  it.each([
    [{ clientTicks: 10 }],
    [{ saveCounter: 0, clientTicks: -1 }],
    [{ saveCounter: 0, clientTicks: 1.5 }],
    [{ saveCounter: 0, clientTicks: "10" }],
  ])("驗證 %j", async (payload) => {
    seedSave(SWORD);
    const res = await post(sync, payload);
    expect(res.status).toBe(400);
  });

  it("沒有存檔回 404", async () => {
    const res = await post(sync, { saveCounter: 0, clientTicks: 0 });
    expect(res.status).toBe(404);
  });
});

describe("POST /api/idle/allocate", () => {
  it("加點：扣掉成本（1→5 共 4 點），saveCounter + 1", async () => {
    const s0 = seedSave(SWORD);
    const res = await post(allocate, { saveCounter: s0.saveCounter, attributes: { dex: 4 } });
    expect(res.status).toBe(200);
    const body = await read(res);
    expect(body.state.attributes.dex).toBe(5);
    expect(body.state.unspentPoints).toBe(levelPoints(1) - 4);
    expect(body.state.saveCounter).toBe(s0.saveCounter + 1);
  });

  it("點數不夠、負數、小數、未知屬性、空的加點都被拒絕，且不寫入", async () => {
    const s0 = seedSave(SWORD);
    const cases: [unknown, string][] = [
      [{ str: 7 }, "可用點數不足。"],
      [{ str: 3, dex: 4 }, "可用點數不足。"],
      [{ str: -1 }, "屬性點數必須是大於等於 0 的整數。"],
      [{ str: 1.5 }, "屬性點數必須是大於等於 0 的整數。"],
      [{ luck: 1 }, "不認得的屬性：luck。"],
      [{}, "請至少加 1 點屬性。"],
      [{ str: 0 }, "請至少加 1 點屬性。"],
      [null, "請提供要加的屬性點數。"],
    ];
    for (const [attributes, error] of cases) {
      const res = await post(allocate, { saveCounter: s0.saveCounter, attributes });
      expect(res.status).toBe(400);
      expect((await read(res)).error).toBe(error);
    }
    const stored = JSON.parse(
      (getUserDb().prepare("SELECT state FROM idle_saves WHERE sub = ?").get(sub) as { state: string }).state,
    ) as IdleState;
    expect(stored.saveCounter).toBe(s0.saveCounter);
    expect(stored.unspentPoints).toBe(levelPoints(1));
  });

  it("先結算到現在再驗證：離線期間升級得到的點數可以用", async () => {
    const s0 = seedSave(SWORD);
    vi.setSystemTime(T0 + 3600_000);
    const res = await post(allocate, { saveCounter: s0.saveCounter, attributes: { str: 7 } });
    expect(res.status).toBe(200);
    const body = await read(res);
    expect(body.state.level).toBeGreaterThan(1);
    expect(body.state.attributes.str).toBe(8);
    expect(body.state.unspentPoints).toBe(levelPoints(body.state.level) - 7);
    expect(body.summary.levelUps).toBe(body.state.level - 1);
  });

  it("成本隨屬性值遞增（nextCost）：10 → 12 花 2 + 2 點，再多一點就不夠", async () => {
    seedSave(SWORD);
    putState(makeState({ attributes: { str: 10, pow: 1, vit: 1, agi: 1, dex: 1, wis: 1 }, unspentPoints: 5, lastSettledAt: T0 }));
    const tooMany = await post(allocate, { saveCounter: 0, attributes: { str: 3 } });
    expect(tooMany.status).toBe(400);
    expect((await read(tooMany)).error).toBe("可用點數不足。");
    const ok = await read(await post(allocate, { saveCounter: 0, attributes: { str: 2 } }));
    expect(ok.state.attributes.str).toBe(12);
    expect(ok.state.unspentPoints).toBe(1);
  });

  it("saveCounter 不符回 409", async () => {
    const s0 = seedSave(SWORD);
    const res = await post(allocate, { saveCounter: s0.saveCounter + 1, attributes: { str: 1 } });
    expect(res.status).toBe(409);
    expect((await read(res)).state).toEqual(s0);
  });

  it("命中不足暫停中，配點後解除暫停", async () => {
    seedSave(SWORD);
    putState(
      makeState({
        lastSettledAt: T0,
        phase: { kind: "blocked", monsterId: 5408, required: 100 },
      }),
    );
    const res = await post(allocate, { saveCounter: 0, attributes: { dex: 1 } });
    const body = await read(res);
    expect(body.state.phase).toEqual({ kind: "searching", remaining: 180 });
  });
});

describe("POST /api/idle/skill", () => {
  it("Lv1 沒有可學的技能：指定技能被拒絕，null（自動）可以", async () => {
    seedSave(SWORD);
    const bad = await post(skill, { saveCounter: 0, skillId: 112 });
    expect(bad.status).toBe(400);
    expect((await read(bad)).error).toBe("目前的等級或武器不能使用這個技能。");
    const ok = await post(skill, { saveCounter: 0, skillId: null });
    expect(ok.status).toBe(200);
  });

  it("Lv15 拿劍可以選星雲劍法，技能等級取可學的最高級；武器不符的掌法被拒絕", async () => {
    seedSave(SWORD);
    putState(
      makeState({
        level: 15,
        unspentPoints: 0,
        attributes: { str: 20, pow: 1, vit: 1, agi: 1, dex: 20, wis: 1 },
        lastSettledAt: T0,
      }),
    );
    const bad = await post(skill, { saveCounter: 0, skillId: 114 });
    expect(bad.status).toBe(400);
    const ok = await read(await post(skill, { saveCounter: 0, skillId: 112 }));
    expect(ok.state.skillId).toBe(112);
    expect(ok.state.skillLevel).toBe(2);
    expect(ok.options.skills.map((o: { skillId: number }) => o.skillId)).toContain(112);
    expect(typeof ok.options.defaultSkillId).toBe("number");
  });

  it("驗證請求內容", async () => {
    seedSave(SWORD);
    expect((await post(skill, { saveCounter: 0, skillId: "112" })).status).toBe(400);
    expect((await post(skill, { saveCounter: 0 })).status).toBe(400);
    expect((await post(skill, { skillId: null })).status).toBe(400);
  });
});

describe("POST /api/idle/job-change", () => {
  const novice = (over: Partial<IdleState> = {}) =>
    makeState({ presetId: 102, sectId: 1, gender: "m", level: 9, unspentPoints: 0, lastSettledAt: T0, ...over });

  it("Lv9 的入門弟子轉入移花宮：換預設角色、技能重設，技能選項來自新門派", async () => {
    putState(novice({ skillId: null }));
    const res = await post(jobChange, { saveCounter: 0, sectId: 4 });
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = await read(res);
    expect(body.state).toMatchObject({ presetId: 304, weaponItemId: 20101, sectId: 4, gender: "m", skillId: null, saveCounter: 1 });
    expect(body.state.skillLevel).toBeGreaterThan(0);
    const ids = body.options.skills.map((o: { skillId: number }) => o.skillId);
    expect(ids).toContain(112); // 星雲劍法，Lv9 可學
    expect(typeof body.options.defaultSkillId).toBe("number");
  });

  it("依性別挑預設角色：女性惡人谷 203、天外天 407", async () => {
    putState(novice({ presetId: 103, gender: "f" }));
    const bad = await read(await post(jobChange, { saveCounter: 0, sectId: 2 }));
    expect(bad.state).toMatchObject({ presetId: 203, sectId: 2, gender: "f" });
    putState(novice({ presetId: 103, gender: "f" }));
    const sky = await read(await post(jobChange, { saveCounter: 0, sectId: 8 }));
    expect(sky.state).toMatchObject({ presetId: 407, sectId: 8 });
  });

  it("沒到 9 級被拒絕，且不寫入", async () => {
    putState(novice({ level: 8 }));
    const res = await post(jobChange, { saveCounter: 0, sectId: 4 });
    expect(res.status).toBe(400);
    expect((await read(res)).error).toBe("需要到 9 級才能轉職。");
    const stored = JSON.parse(
      (getUserDb().prepare("SELECT state FROM idle_saves WHERE sub = ?").get(sub) as { state: string }).state,
    ) as IdleState;
    expect(stored).toMatchObject({ presetId: 102, sectId: 1, saveCounter: 0 });
  });

  it("已經有門派不能再轉職", async () => {
    putState(makeState({ level: 20, lastSettledAt: T0 }));
    const res = await post(jobChange, { saveCounter: 0, sectId: 2 });
    expect(res.status).toBe(400);
    expect((await read(res)).error).toBe("已經拜入門派，不能再轉職。");
  });

  it.each([[{}], [{ sectId: 1 }], [{ sectId: 16 }], [{ sectId: "4" }], [{ sectId: null }]])(
    "不能轉入的門派 %j 被拒絕",
    async (extra) => {
      putState(novice());
      const res = await post(jobChange, { saveCounter: 0, ...extra });
      expect(res.status).toBe(400);
      expect((await read(res)).error).toBe("請選擇要拜入的門派。");
    },
  );

  it("缺少 saveCounter 回 400；舊的 saveCounter 回 409 並帶目前的存檔", async () => {
    putState(novice());
    expect((await post(jobChange, { sectId: 4 })).status).toBe(400);
    const stale = await post(jobChange, { saveCounter: 3, sectId: 4 });
    expect(stale.status).toBe(409);
    expect(stale.headers.get("Cache-Control")).toBe("no-store");
    const body = await read(stale);
    expect(body.state).toMatchObject({ presetId: 102, sectId: 1 });
  });

  it("沒有存檔回 404", async () => {
    const res = await post(jobChange, { saveCounter: 0, sectId: 4 });
    expect(res.status).toBe(404);
  });
});

describe("GET /api/idle/jobs", () => {
  const jobsFor = (gender: string) => jobs(new Request(`http://localhost/api/idle/jobs?gender=${gender}`));

  it("三個門派：名稱、預設角色、武器、代表招式與預覽動作圖；可以快取", async () => {
    const res = await jobsFor("m");
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toContain("public");
    const body = await read(res);
    expect(body.jobs.map((j: Json) => [j.sectId, j.sectName, j.presetId, j.weaponName])).toEqual([
      [2, "惡人谷", 202, "青銅刀"],
      [4, "移花宮", 304, "長劍"],
      [8, "天外天", 406, "匕首"],
    ]);
    for (const job of body.jobs as Json[]) {
      expect(job.presetLabel).toContain("・");
      expect(job.skills.length).toBeGreaterThan(0);
      expect(job.skills.length).toBeLessThanOrEqual(3);
      const levels = job.skills.map((s: Json) => s.learnLevel);
      expect(levels).toEqual([...levels].sort((a: number, b: number) => a - b));
      expect(job.sprite.url).toEqual(expect.any(String));
      expect(job.sprite.cellW).toBeGreaterThan(0);
    }
    expect(body.jobs.map((j: Json) => j.styles.map((s: Json) => [s.key, s.enabled]))).toEqual([
      [["blade", true], ["trick", true]],
      [["sword", true], ["palm", true]],
      [["sting", true], ["poison", false]],
    ]);
    // 移花宮拿劍：掌法（要空手）不列在代表招式裡。
    const flower = (body.jobs as Json[]).find((j) => j.sectId === 4)!;
    expect(flower.skills.map((s: Json) => s.name)).not.toContain("無相明玉掌");
  });

  it("女性用女性預設角色", async () => {
    const body = await read(await jobsFor("f"));
    expect(body.jobs.map((j: Json) => j.presetId)).toEqual([203, 305, 407]);
  });

  it.each(["", "x"])("性別 %j 回 400", async (gender) => {
    expect((await jobsFor(gender)).status).toBe(400);
  });
});

describe("POST /api/idle/weapon", () => {
  const flower = (over: Partial<IdleState> = {}) =>
    makeState({ presetId: 304, weaponItemId: 20101, sectId: 4, gender: "m", level: 15, unspentPoints: 0, lastSettledAt: T0, ...over });
  const ids = (body: Json) => body.options.skills.map((o: { skillId: number }) => o.skillId);

  it("移花宮換手套練掌法：換空手外觀、指定武器、技能改回自動，技能選項換成掌法", async () => {
    putState(flower({ skillId: 112, skillLevel: 2 }));
    const res = await post(weapon, { saveCounter: 0, style: "palm" });
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = await read(res);
    expect(body.state).toMatchObject({ presetId: 300, weaponItemId: 20259, sectId: 4, skillId: null, saveCounter: 1 });
    expect(ids(body)).toContain(114); // 無相明玉掌
    expect(ids(body)).not.toContain(112); // 星雲劍法要拿劍
    // 換回劍。
    const back = await read(await post(weapon, { saveCounter: 1, style: "sword" }));
    expect(back.state).toMatchObject({ presetId: 304, weaponItemId: 20101, skillId: null });
    expect(ids(back)).toContain(112);
    expect(ids(back)).not.toContain(114);
  });

  it("惡人谷：詐招要拿手套，刀法拿刀；女性用女性外觀", async () => {
    putState(flower({ presetId: 203, weaponItemId: 20001, sectId: 2, gender: "f" }));
    const bladeBody = await read(await post(weapon, { saveCounter: 0, style: "blade" })); // 已經是刀法：同樣可以
    expect(bladeBody.state).toMatchObject({ presetId: 203, weaponItemId: 20001 });
    expect(ids(bladeBody)).toContain(105); // 血殺刀
    const trick = await read(await post(weapon, { saveCounter: 1, style: "trick" }));
    expect(trick.state).toMatchObject({ presetId: 201, weaponItemId: 20259, sectId: 2, gender: "f" });
    expect(ids(trick)).toContain(102); // 灑沙（詐招）
    expect(ids(trick)).not.toContain(105);
  });

  it("入門弟子被拒絕", async () => {
    putState(makeState({ presetId: 102, sectId: 1, gender: "m", level: 9, lastSettledAt: T0 }));
    const res = await post(weapon, { saveCounter: 0, style: "palm" });
    expect(res.status).toBe(400);
    expect((await read(res)).error).toBe("入門弟子還不能換武器，先轉職拜入門派吧。");
  });

  it("不認得的武器、別的門派的武器、尚未開放的毒術都被拒絕，且不寫入", async () => {
    putState(makeState({ presetId: 406, weaponItemId: 20301, sectId: 8, gender: "m", level: 15, lastSettledAt: T0 }));
    const cases: [unknown, string][] = [
      [{ style: "blade" }, "不認得這種武器。"], // 惡人谷的流派
      [{ style: "nope" }, "不認得這種武器。"],
      [{ style: "poison" }, "毒術：毒術流派（手套／拂塵）之後開放。"],
      [{ style: 1 }, "請選擇武器。"],
      [{}, "請選擇武器。"],
    ];
    for (const [extra, error] of cases) {
      const res = await post(weapon, { saveCounter: 0, ...(extra as object) });
      expect(res.status).toBe(400);
      expect((await read(res)).error).toBe(error);
    }
    const stored = JSON.parse(
      (getUserDb().prepare("SELECT state FROM idle_saves WHERE sub = ?").get(sub) as { state: string }).state,
    ) as IdleState;
    expect(stored).toMatchObject({ presetId: 406, saveCounter: 0 });
  });

  it("缺少 saveCounter 回 400；舊的 saveCounter 回 409；沒有存檔回 404", async () => {
    expect((await post(weapon, { style: "palm" })).status).toBe(400);
    expect((await post(weapon, { saveCounter: 0, style: "palm" })).status).toBe(404);
    putState(flower());
    const stale = await post(weapon, { saveCounter: 4, style: "palm" });
    expect(stale.status).toBe(409);
    expect((await read(stale)).state).toMatchObject({ presetId: 304 });
  });

  it("轉職後預設流派寫進存檔（刀法 20001），再換武器不需要重新轉職", async () => {
    putState(makeState({ presetId: 102, sectId: 1, gender: "m", level: 9, lastSettledAt: T0 }));
    const changed = await read(await post(jobChange, { saveCounter: 0, sectId: 2 }));
    expect(changed.state).toMatchObject({ presetId: 202, weaponItemId: 20001 });
    const trick = await read(await post(weapon, { saveCounter: 1, style: "trick" }));
    expect(trick.state).toMatchObject({ presetId: 200, weaponItemId: 20259 });
  });
});

describe("GET /api/idle/data 的 weapon 參數", () => {
  const get = (query: string) => idleData(new Request(`http://localhost/api/idle/data?${query}`));

  it("空手外觀的預設角色拿指定武器；不是武器流派的組合被拒絕", async () => {
    const ok = await get("preset=300&weapon=20259");
    expect(ok.status).toBe(200);
    const body = await read(ok);
    expect(body.data.weapon).toMatchObject({ id: 20259, typeName: "PUNCHER" });
    expect(body.data.skills.length).toBeGreaterThan(0);
    expect((await get("preset=300&weapon=20001")).status).toBe(404);
    expect((await get("preset=304&weapon=20259")).status).toBe(404);
    expect((await get("preset=300&weapon=abc")).status).toBe(400);
    expect((await read(await get("preset=300"))).data.weapon).toBeNull(); // 沒指定：預設角色沒有武器
  });
});
