import { describe, expect, it } from "vitest";
import { NORMAL_ATTACK_HIT_TICK, NORMAL_ATTACK_TICKS, POST_CAST_TICKS, SEARCH_TICKS } from "@/configs/idle";
import { levelPoints } from "@/lib/stat-sim";
import { advance, killExp, resumeIfBlocked } from "../engine";
import { SeededRng } from "../rng";
import type { IdleEvent, IdleMonster } from "../types";
import { LATE_HIT_SKILL, MULTI_HIT_SKILL, makeData, makeState, monster } from "./fixtures";

const json = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** 事件的 t 是各次 advance 內的位移；把第二段平移 offset 後才能和單次跑的事件逐筆比對。 */
const shift = (events: IdleEvent[], offset: number): IdleEvent[] => events.map((e) => ({ ...e, t: e.t + offset }));

const only = (id: number, over: Partial<IdleMonster> = {}) => ({
  monsters: { [id]: monster({ ...over, id }) },
  spawns: [{ monsterId: id, weight: 1 }],
});

describe("SeededRng", () => {
  it("同一個種子產生同一串數字，狀態可序列化後接續", () => {
    const a = new SeededRng(42);
    const first = [a.next(), a.next(), a.randrange(100), a.randint(5, 9)];
    const b = new SeededRng(42);
    expect([b.next(), b.next(), b.randrange(100), b.randint(5, 9)]).toEqual(first);
    const c = new SeededRng(a.state);
    expect(c.next()).toBe(a.next());
    for (let i = 0; i < 1000; i++) {
      const v = a.randint(3, 5);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(5);
    }
  });
});

describe("advance 確定性", () => {
  const data = makeData();

  it("同樣的輸入得到同樣的輸出，且不改動輸入", () => {
    const state = makeState();
    const snapshot = json(state);
    const a = advance(state, 50_000, data, { collectEvents: true });
    const b = advance(state, 50_000, data, { collectEvents: true });
    expect(json(a)).toEqual(json(b));
    expect(state).toEqual(snapshot);
    expect(a.summary.kills).toBeGreaterThan(0);
  });

  it.each([1, 2, 179, 180, 181, 1000, 2345, 7777, 30_000])(
    "advance(s, a + b) 等於 advance(advance(s, a), b)：a = %i",
    (a) => {
      const b = 40_000;
      const state = makeState();
      const whole = advance(state, a + b, data, { collectEvents: true });
      const first = advance(state, a, data, { collectEvents: true });
      const second = advance(first.state, b, data, { collectEvents: true });
      expect(json(second.state)).toEqual(json(whole.state));
      expect(json([...first.events, ...shift(second.events, a)])).toEqual(json(whole.events));
      expect(first.summary.kills + second.summary.kills).toBe(whole.summary.kills);
      expect(first.summary.exp + second.summary.exp).toBe(whole.summary.exp);
    },
  );

  it("切成很多小段也相同（含切在施放中途與找怪中途）", () => {
    const state = makeState();
    const whole = advance(state, 20_000, data).state;
    let cur = state;
    for (let i = 0; i < 400; i++) cur = advance(cur, 50, data).state;
    expect(json(cur)).toEqual(json(whole));
  });

  it("state 永遠是純 JSON（沒有 undefined / NaN）", () => {
    const { state } = advance(makeState(), 100_000, data);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it("快轉（不收集事件）與事件路徑完全一致，而且不產生事件", () => {
    for (const seed of [1, 99, 123456789]) {
      const state = makeState({ seed });
      const fast = advance(state, 300_000, data);
      const full = advance(state, 300_000, data, { collectEvents: true });
      expect(fast.events).toEqual([]);
      expect(full.events.length).toBeGreaterThan(0);
      expect(json(fast.state)).toEqual(json(full.state));
      expect(fast.summary).toEqual(full.summary);
    }
  });

  it("事件統計與 summary 對得起來", () => {
    const { events, summary, state } = advance(makeState(), 100_000, data, { collectEvents: true });
    const kills = events.filter((e) => e.type === "kill");
    expect(kills).toHaveLength(summary.kills);
    expect(kills.reduce((s, e) => s + (e.type === "kill" ? e.exp : 0), 0)).toBe(summary.exp);
    expect(kills.reduce((s, e) => s + (e.type === "kill" ? e.money : 0), 0)).toBe(summary.money);
    expect(state.money).toBe(summary.money);
    expect(events.filter((e) => e.type === "level-up")).toHaveLength(summary.levelUps);
    expect(events.filter((e) => e.type === "hit")).toHaveLength(summary.hits);
    expect(events.filter((e) => e.type === "miss")).toHaveLength(summary.misses);
  });
});

describe("階段與施放時間軸", () => {
  it("星雲劍法：命中在最後一個 tick（20 / 20）也會打到；一次施放後怪物死亡", () => {
    const data = makeData({ skills: [LATE_HIT_SKILL], ...only(5407, { hp: 1 }), levelExp: [0, 1e9] });
    const { events } = advance(makeState({ skillId: 112 }), SEARCH_TICKS + 20, data, { collectEvents: true });
    expect(events.map((e) => [e.type, e.t])).toEqual([
      ["encounter", SEARCH_TICKS],
      ["cast", SEARCH_TICKS],
      ["hit", SEARCH_TICKS + 20],
      ["kill", SEARCH_TICKS + 20],
    ]);
  });

  it("落英繽紛：tick 0 的命中在施放當下發生，第二段在 +8；沒死就在間隔後再施放", () => {
    const data = makeData({ skills: [MULTI_HIT_SKILL], ...only(5407, { hp: 100000 }) });
    const { events } = advance(makeState({ skillId: 111 }), SEARCH_TICKS + 79 + POST_CAST_TICKS + 1, data, {
      collectEvents: true,
    });
    const types = events.map((e) => [e.type, e.t]);
    expect(types.slice(0, 4)).toEqual([
      ["encounter", SEARCH_TICKS],
      ["cast", SEARCH_TICKS],
      ["hit", SEARCH_TICKS],
      ["hit", SEARCH_TICKS + 8],
    ]);
    expect(types[4]).toEqual(["cast", SEARCH_TICKS + 79 + POST_CAST_TICKS]);
  });

  it("多段只呼叫一次 playerHit：兩段傷害來自同一次判定（要嘛 2 hit 要嘛 1 miss）", () => {
    const data = makeData({ skills: [MULTI_HIT_SKILL], ...only(5407, { hp: 100000, baseDodge: 70 }) });
    const state = makeState({ skillId: 111, attributes: { str: 1, pow: 1, vit: 1, agi: 1, dex: 4, wis: 1 } });
    const { events } = advance(state, 200_000, data, { collectEvents: true });
    let casts = 0;
    let hits = 0;
    let misses = 0;
    events.forEach((event, i) => {
      if (event.type !== "cast") return;
      casts++;
      const next = events.slice(i + 1, i + 3).map((e) => e.type);
      if (next[0] === "miss") misses++;
      else {
        hits++;
        expect(next).toEqual(["hit", "hit"]);
      }
    });
    expect(casts).toBeGreaterThan(10);
    expect(hits).toBeGreaterThan(0);
    expect(misses).toBeGreaterThan(0);
  });

  it("怪物在施放中途死亡：不中斷施放，後面的命中是 overkill（無事件、不計入）", () => {
    const data = makeData({ skills: [MULTI_HIT_SKILL], ...only(5407, { hp: 1 }) });
    const { events, state, summary } = advance(makeState({ skillId: 111 }), SEARCH_TICKS + 79, data, {
      collectEvents: true,
    });
    expect(events.filter((e) => e.type === "hit")).toHaveLength(1);
    expect(events.filter((e) => e.type === "kill")).toHaveLength(1);
    expect(summary.hits).toBe(1);
    expect(summary.damage).toBe(1);
    // 施放跑完才回到找怪。
    expect(events.at(-1)).toEqual({ t: SEARCH_TICKS + 79, type: "search-start" });
    expect(state.phase).toEqual({ kind: "searching", remaining: SEARCH_TICKS });
  });

  it("沒有可用技能時用普攻（Lv1..8 沒有門派技能）", () => {
    const data = makeData({ skills: [], ...only(5407, { hp: 1 }) });
    const { events } = advance(makeState(), SEARCH_TICKS + NORMAL_ATTACK_TICKS, data, { collectEvents: true });
    expect(events[1]).toEqual({ t: SEARCH_TICKS, type: "cast", skillId: null, castTicks: NORMAL_ATTACK_TICKS });
    expect(events[2]).toMatchObject({ t: SEARCH_TICKS + NORMAL_ATTACK_HIT_TICK, type: "hit" });
  });

  it("依 monster_spawns 權重遇怪", () => {
    const data = makeData({
      spawns: [
        { monsterId: 5407, weight: 3 },
        { monsterId: 5408, weight: 1 },
      ],
      skills: [],
    });
    const { events } = advance(makeState(), 400_000, data, { collectEvents: true });
    const counts: Record<number, number> = { 5407: 0, 5408: 0 };
    for (const e of events) if (e.type === "encounter") counts[e.monsterId]++;
    const share = counts[5407] / (counts[5407] + counts[5408]);
    expect(share).toBeGreaterThan(0.65);
    expect(share).toBeLessThan(0.85);
  });

  it("擊倒獎勵：經驗 = drop_exp，金錢在 drop_money_min..max", () => {
    const data = makeData({ skills: [], ...only(5408, { hp: 1, dropExp: 94, dropMoneyMin: 1, dropMoneyMax: 7 }) });
    const { events } = advance(makeState(), 300_000, data, { collectEvents: true });
    const kills = events.filter((e) => e.type === "kill");
    expect(kills.length).toBeGreaterThan(50);
    const monies = new Set<number>();
    for (const k of kills) {
      if (k.type !== "kill") continue;
      expect(k.exp).toBe(94);
      expect(k.money).toBeGreaterThanOrEqual(1);
      expect(k.money).toBeLessThanOrEqual(7);
      monies.add(k.money);
    }
    expect(monies.size).toBeGreaterThan(3);
  });
});

describe("升級", () => {
  it("經驗溢出連續升級，點數 = levelPoints(新) − levelPoints(舊)，剩餘經驗留在新等級", () => {
    // 每級只要 10 經驗；一隻怪給 35：Lv1 到 Lv4，剩 5。
    const data = makeData({
      skills: [],
      ...only(5407, { hp: 1, dropExp: 35 }),
      levelExp: [0, 10, 10, 10, 10, 10, 10],
    });
    const at = SEARCH_TICKS + NORMAL_ATTACK_HIT_TICK;
    const { state, events, summary } = advance(makeState(), at, data, { collectEvents: true });
    expect(events.filter((e) => e.type === "level-up")).toEqual([
      { t: at, type: "level-up", level: 2, points: levelPoints(2) - levelPoints(1) },
      { t: at, type: "level-up", level: 3, points: levelPoints(3) - levelPoints(2) },
      { t: at, type: "level-up", level: 4, points: levelPoints(4) - levelPoints(3) },
    ]);
    expect(state.level).toBe(4);
    expect(state.exp).toBe(5);
    expect(state.unspentPoints).toBe(levelPoints(4));
    expect(summary).toMatchObject({
      levelBefore: 1,
      levelAfter: 4,
      levelUps: 3,
      pointsGained: levelPoints(4) - levelPoints(1),
    });
  });

  it("levelPoints 是累計值：Lv1 = 6，Lv1..25 每級 +2", () => {
    expect(levelPoints(1)).toBe(6);
    expect(levelPoints(2) - levelPoints(1)).toBe(2);
    expect(levelPoints(25) - levelPoints(24)).toBe(2);
  });

  it("到最高等級後經驗只累積，不讀到 undefined", () => {
    const data = makeData({ skills: [], ...only(5407, { hp: 1, dropExp: 500 }), levelExp: [0, 10, 10] });
    const { state } = advance(makeState(), 100_000, data);
    expect(state.level).toBe(3);
    expect(Number.isFinite(state.exp)).toBe(true);
    expect(state.exp).toBeGreaterThan(500);
  });

  it("等級差：比怪高 15 級以內拿全額，超過只拿 1；比怪低等也拿全額", () => {
    const horse = { level: 3, dropExp: 85 };
    expect(killExp(1, horse)).toBe(85);
    expect(killExp(18, horse)).toBe(85);
    expect(killExp(19, horse)).toBe(1);
    expect(killExp(60, horse)).toBe(1);
  });

  it("擊殺事件與統計用等級差後的經驗", () => {
    const data = makeData({ skills: [], ...only(5407, { hp: 1, dropExp: 85 }), levelExp: [0, ...Array(30).fill(1e9)] });
    const { state, events } = advance(makeState({ level: 19 }), 2_000, data, { collectEvents: true });
    const kills = events.filter((e) => e.type === "kill");
    expect(kills.length).toBeGreaterThan(0);
    expect(kills.every((e) => e.type === "kill" && e.exp === 1)).toBe(true);
    expect(state.stats.exp).toBe(kills.length);
  });
});

describe("命中不足", () => {
  const hard = makeData({ skills: [], ...only(5407, { baseDodge: 1000 }) });

  it("命中率 0：發出 hit-too-low 並停在 blocked，不再空轉", () => {
    const { state, events, summary } = advance(makeState(), SEARCH_TICKS + 5000, hard, { collectEvents: true });
    expect(events.map((e) => e.type)).toEqual(["encounter", "hit-too-low"]);
    // 命中 = Lv1 的 51 + 技巧 3 = 54；普攻 p1 以 100 計，需要 ceil(1000 × 100 / 100) = 1000。
    expect(events[1]).toEqual({ t: SEARCH_TICKS, type: "hit-too-low", required: 1000, current: 54 });
    expect(state.phase).toEqual({ kind: "blocked", monsterId: 5407, required: 1000 });
    expect(summary.blocked).toBe(true);
    expect(summary.kills).toBe(0);
  });

  it("blocked 的 advance 是 O(1)，狀態不變", () => {
    const blocked = advance(makeState(), SEARCH_TICKS, hard).state;
    const started = performance.now();
    const after = advance(blocked, 2_000_000_000, hard);
    expect(performance.now() - started).toBeLessThan(200);
    expect(after.state.phase).toEqual(blocked.phase);
    expect(after.state.seed).toBe(blocked.seed);
  });

  it("配點後（resumeIfBlocked）重新找怪；命中夠了就能打", () => {
    const blocked = advance(makeState(), SEARCH_TICKS, hard).state;
    expect(resumeIfBlocked(blocked).phase).toEqual({ kind: "searching", remaining: SEARCH_TICKS });
    expect(resumeIfBlocked(makeState())).toEqual(makeState());
    const easier = makeData({ skills: [], ...only(5407, { baseDodge: 20, hp: 1 }) });
    const resumed = advance(resumeIfBlocked(blocked), 5000, easier);
    expect(resumed.summary.kills).toBeGreaterThan(0);
  });

  it("技能的 func_hit_p1 會拉高需求命中", () => {
    const data = makeData({ skills: [LATE_HIT_SKILL], ...only(5407, { baseDodge: 1000 }) });
    const { events } = advance(makeState({ skillId: 112 }), SEARCH_TICKS, data, { collectEvents: true });
    // ceil(1000 × 100 / 90) = 1112
    expect(events.at(-1)).toMatchObject({ type: "hit-too-low", required: 1112 });
  });
});
