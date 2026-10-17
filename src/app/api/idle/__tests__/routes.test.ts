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
import { msToTicks } from "@/lib/idle-saves";
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
import { POST as autoAllocate } from "../auto-allocate/route";

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
    await start(new Request("http://localhost", { method: "POST", body: JSON.stringify({ presetId: SWORD }) }));
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
    await post(start, { presetId: SWORD });
    vi.setSystemTime(T0 + 48 * 3600_000);
    const body = await read(await GET());
    expect(body.offlineSummary.ticks).toBe(msToTicks(OFFLINE_CAP_MS));
  });
});

describe("POST /api/idle/start", () => {
  it("建立 Lv1 存檔：六圍全 1、Lv1 的 6 點尚未分配、seed 來自 crypto", async () => {
    const res = await post(start, { presetId: SWORD });
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = await read(res);
    expect(body.state).toMatchObject({
      presetId: SWORD,
      gender: "m",
      sectId: 4,
      level: 1,
      exp: 0,
      money: 0,
      attributes: { str: 1, pow: 1, vit: 1, agi: 1, dex: 1, wis: 1 },
      unspentPoints: levelPoints(1),
      skillId: null,
      stageId: 147,
      saveCounter: 0,
      lastSettledAt: T0,
      phase: { kind: "searching" },
    });
    expect(Number.isInteger(body.state.seed)).toBe(true);
    expect(body.options.skills).toEqual([]);
    const second = await post(start, { presetId: SWORD });
    expect(second.status).toBe(409);
    expect((await read(second)).error).toBe("已經有存檔了。");
  });

  it("兩個存檔的種子不同", async () => {
    const a = await read(await post(start, { presetId: SWORD }));
    sub = "U_other";
    const b = await read(await post(start, { presetId: SWORD }));
    expect(a.state.seed).not.toBe(b.state.seed);
    getUserDb().prepare("DELETE FROM idle_saves WHERE sub = 'U_other'").run();
  });

  it.each([
    [{}, "請選擇角色。"],
    [{ presetId: "304" }, "請選擇角色。"],
    [{ presetId: 999999 }, "找不到這個角色。"],
    [{ presetId: 100 }, "這個門派目前還不支援放置玩法。"], // 入門弟子 sect 1
    [{ presetId: 1220 }, "這個角色的武器目前還不支援放置玩法。"], // 曼陀・扇
  ])("拒絕 %j", async (payload, error) => {
    const res = await post(start, payload);
    expect(res.status).toBe(400);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect((await read(res)).error).toBe(error);
  });

  it("沒登入時回 requireAuth 的錯誤，且 no-store", async () => {
    sub = null;
    const res = await post(start, { presetId: SWORD });
    expect(res.status).toBe(400);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("請求不是 JSON 物件", async () => {
    const res = await start(new Request("http://localhost", { method: "POST", body: "nope" }));
    expect(res.status).toBe(400);
    expect((await read(res)).error).toBe("請求格式不正確。");
  });
});

describe("POST /api/idle/sync", () => {
  async function startSave() {
    return (await read(await post(start, { presetId: SWORD }))).state as IdleState;
  }

  it("伺服器 ticks = min(瀏覽器回報, 實際經過)：回報太多被壓低，回報較少照回報", async () => {
    const s0 = await startSave();
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
    const s0 = await startSave();
    const now = T0 + 48 * 3600_000;
    vi.setSystemTime(now);
    const first = await read(await post(sync, { saveCounter: s0.saveCounter, clientTicks: 1_000_000_000 }));
    expect(first.summary.ticks).toBe(msToTicks(OFFLINE_CAP_MS));
    expect(first.state.lastSettledAt).toBe(now);
    const second = await read(await post(sync, { saveCounter: 1, clientTicks: 1_000_000_000 }));
    expect(second.summary.ticks).toBe(0);
  });

  it("結果與直接重跑引擎相同（瀏覽器只送時間、不送結果）", async () => {
    const s0 = await startSave();
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
    const s0 = await startSave();
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
    await startSave();
    const res = await post(sync, payload);
    expect(res.status).toBe(400);
  });

  it("沒有存檔回 404", async () => {
    const res = await post(sync, { saveCounter: 0, clientTicks: 0 });
    expect(res.status).toBe(404);
  });
});

describe("POST /api/idle/allocate", () => {
  async function startSave() {
    return (await read(await post(start, { presetId: SWORD }))).state as IdleState;
  }

  it("加點：扣掉成本（1→5 共 4 點），saveCounter + 1", async () => {
    const s0 = await startSave();
    const res = await post(allocate, { saveCounter: s0.saveCounter, attributes: { dex: 4 } });
    expect(res.status).toBe(200);
    const body = await read(res);
    expect(body.state.attributes.dex).toBe(5);
    expect(body.state.unspentPoints).toBe(levelPoints(1) - 4);
    expect(body.state.saveCounter).toBe(s0.saveCounter + 1);
  });

  it("點數不夠、負數、小數、未知屬性、空的加點都被拒絕，且不寫入", async () => {
    const s0 = await startSave();
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
    const s0 = await startSave();
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
    await startSave();
    putState(makeState({ attributes: { str: 10, pow: 1, vit: 1, agi: 1, dex: 1, wis: 1 }, unspentPoints: 5, lastSettledAt: T0 }));
    const tooMany = await post(allocate, { saveCounter: 0, attributes: { str: 3 } });
    expect(tooMany.status).toBe(400);
    expect((await read(tooMany)).error).toBe("可用點數不足。");
    const ok = await read(await post(allocate, { saveCounter: 0, attributes: { str: 2 } }));
    expect(ok.state.attributes.str).toBe(12);
    expect(ok.state.unspentPoints).toBe(1);
  });

  it("saveCounter 不符回 409", async () => {
    const s0 = await startSave();
    const res = await post(allocate, { saveCounter: s0.saveCounter + 1, attributes: { str: 1 } });
    expect(res.status).toBe(409);
    expect((await read(res)).state).toEqual(s0);
  });

  it("命中不足暫停中，配點後解除暫停", async () => {
    await startSave();
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
    await post(start, { presetId: SWORD });
    const bad = await post(skill, { saveCounter: 0, skillId: 112 });
    expect(bad.status).toBe(400);
    expect((await read(bad)).error).toBe("目前的等級或武器不能使用這個技能。");
    const ok = await post(skill, { saveCounter: 0, skillId: null });
    expect(ok.status).toBe(200);
  });

  it("Lv15 拿劍可以選星雲劍法，技能等級取可學的最高級；武器不符的掌法被拒絕", async () => {
    await post(start, { presetId: SWORD });
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
    await post(start, { presetId: SWORD });
    expect((await post(skill, { saveCounter: 0, skillId: "112" })).status).toBe(400);
    expect((await post(skill, { saveCounter: 0 })).status).toBe(400);
    expect((await post(skill, { skillId: null })).status).toBe(400);
  });
});

describe("POST /api/idle/auto-allocate", () => {
  it("先點技巧到對最高閃躲命中率 ≥ 95 %，其餘全點主攻擊屬性（拿劍：外功）", async () => {
    await post(start, { presetId: SWORD });
    const res = await post(autoAllocate, { saveCounter: 0 });
    expect(res.status).toBe(200);
    const body = await read(res);
    expect(body.state.unspentPoints).toBe(0);
    // 肉靶龜閃躲 67、Lv1 命中 51 + 3 × 技巧：技巧 5（4 點）→ 命中 66 → 95 %；剩 2 點外功。
    expect(body.state.attributes).toEqual({ str: 3, pow: 1, vit: 1, agi: 1, dex: 5, wis: 1 });
  });

  it("空手：主攻擊屬性仍是外功（普攻用物攻）；沒有點數時回 400", async () => {
    await post(start, { presetId: 300 });
    expect((await post(autoAllocate, { saveCounter: 0 })).status).toBe(200);
    const none = await post(autoAllocate, { saveCounter: 1 });
    expect(none.status).toBe(400);
    expect((await read(none)).error).toBe("沒有可以配的點數。");
  });

  it("saveCounter 不符回 409", async () => {
    await post(start, { presetId: SWORD });
    expect((await post(autoAllocate, { saveCounter: 9 })).status).toBe(409);
  });
});
