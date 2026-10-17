import { describe, expect, it } from "vitest";
import { SEARCH_TICKS } from "@/configs/idle";
import { advance } from "../engine";
import { buildCombatant } from "../character";
import type { IdleEvent, IdleSummary } from "../types";
import { makeData, makeState } from "./fixtures";
import {
  CORPSE_TICKS,
  applyEvents,
  attackFrameIndex,
  describeEvent,
  formatOfflineDuration,
  killEstimate,
  killRateFromSummary,
  killsPerHour,
  newFx,
  nextLogContext,
  offlineWorthShowing,
  peekEncounter,
  searchesCompleted,
  ticksToMs,
} from "../view";

const ctx = { monsterName: "▲沙包海馬", skillName: "普通攻擊" };

describe("killsPerHour", () => {
  const start = 1_000_000;
  it("觀察時間太短或樣本太少時回傳 null", () => {
    expect(killsPerHour([start + 1000, start + 5000], start + 10_000, start)).toBeNull();
    expect(killsPerHour([start + 30_000], start + 60_000, start)).toBeNull();
  });
  it("以實際觀察區間換算成每小時", () => {
    const times = Array.from({ length: 10 }, (_, i) => start + (i + 1) * 6000);
    // 60 秒內 10 隻 → 每小時 600 隻
    expect(killsPerHour(times, start + 60_000, start)).toBe(600);
  });
  it("只算視窗內的擊倒，視窗滿了就不再除以更長的時間", () => {
    const now = start + 60 * 60_000;
    const times = [start + 1000, now - 5 * 60_000, now - 60_000];
    // 視窗 10 分鐘內 2 隻 → 12 / 小時
    expect(killsPerHour(times, now, start)).toBe(12);
  });
});

describe("killRateFromSummary", () => {
  it("用離線結算估速度，沒有擊倒回傳 null", () => {
    expect(killRateFromSummary({ ticks: 60 * 3600, kills: 700 })).toBe(700);
    expect(killRateFromSummary({ ticks: 60 * 3600, kills: 0 })).toBeNull();
  });
});

describe("describeEvent", () => {
  it("擊倒帶經驗與金錢", () => {
    const e: IdleEvent = { t: 0, type: "kill", monsterId: 5407, exp: 85, money: 3 };
    expect(describeEvent(e, ctx)).toEqual({ text: "擊倒 ▲沙包海馬", gain: "+85 經驗　+3 金錢" });
  });
  it("只記重擊與未命中，一般命中不記", () => {
    expect(describeEvent({ t: 0, type: "hit", damage: 12, kind: "hit" }, ctx)).toBeNull();
    expect(describeEvent({ t: 0, type: "hit", damage: 1234, kind: "crit" }, ctx)).toEqual({
      text: "普通攻擊重擊 ▲沙包海馬",
      gain: "1,234 傷害",
    });
    expect(describeEvent({ t: 0, type: "miss" }, ctx)?.text).toBe("普通攻擊未命中 ▲沙包海馬");
  });
  it("升級與命中不足", () => {
    expect(describeEvent({ t: 0, type: "level-up", level: 4, points: 3 }, ctx)).toEqual({
      text: "升到 Lv.4，獲得屬性點",
      gain: "+3 點",
    });
    expect(describeEvent({ t: 0, type: "hit-too-low", required: 120, current: 60 }, ctx)?.text).toContain("120");
    expect(describeEvent({ t: 0, type: "search-start" }, ctx)).toBeNull();
  });
  it("context 跟著遇怪與施放更新", () => {
    const data = makeData();
    const a = nextLogContext(ctx, { t: 0, type: "encounter", monsterId: 5408 }, data);
    expect(a.monsterName).toBe("怪5408");
    const b = nextLogContext(a, { t: 0, type: "cast", skillId: null, castTicks: 42 }, data);
    expect(b.skillName).toBe("普通攻擊");
    const c = nextLogContext(b, { t: 0, type: "cast", skillId: 111, castTicks: 79 }, data);
    expect(c.skillName).toBe("落英繽紛");
  });
});

describe("場景暫態", () => {
  it("事件換成場景時間：受擊、擊倒、屍體消失", () => {
    const fx = newFx();
    applyEvents(
      fx,
      [
        { t: 0, type: "encounter", monsterId: 5407 },
        { t: 10, type: "hit", damage: 30, kind: "hit" },
        { t: 20, type: "hit", damage: 25, kind: "crit" },
        { t: 20, type: "kill", monsterId: 5407, exp: 85, money: 3 },
        { t: 30, type: "search-start" },
      ],
      100,
    );
    expect(fx.monsterId).toBe(5407);
    expect(fx.hurts).toEqual([110, 120]);
    expect(fx.killAt).toBe(120);
    expect(fx.goneAt).toBe(130 + CORPSE_TICKS);
    expect(fx.popups.map((p) => p.damage)).toEqual([30, 25]);
  });
  it("遇到新的怪就重設", () => {
    const fx = newFx();
    applyEvents(fx, [{ t: 0, type: "encounter", monsterId: 5407 }, { t: 5, type: "hit", damage: 9, kind: "hit" }], 0);
    applyEvents(fx, [{ t: 0, type: "encounter", monsterId: 5408 }], 400);
    expect(fx.monsterId).toBe(5408);
    expect(fx.hurts).toEqual([]);
    expect(fx.popups).toEqual([]);
  });
  it("找怪前看得到會遇到哪隻，且與引擎實際遇到的一致", () => {
    const data = makeData();
    const searching = advance(makeState(), 5, data).state;
    expect(searching.phase.kind).toBe("searching");
    const peek = peekEncounter(searching, data);
    const real = advance(searching, SEARCH_TICKS, data, { collectEvents: true }).events.find(
      (e) => e.type === "encounter",
    );
    expect(real && real.type === "encounter" ? real.monsterId : null).toBe(peek);
  });
  it("背景捲動量在擊倒的那一刻不倒退", () => {
    const data = makeData();
    let s = makeState();
    let prev = -1;
    for (let i = 0; i < 2000; i++) {
      s = advance(s, 1, data).state;
      const now = searchesCompleted(s);
      expect(now).toBeGreaterThanOrEqual(prev);
      prev = now;
    }
    expect(s.stats.kills).toBeGreaterThan(0);
  });
});

describe("killEstimate", () => {
  it("命中率 100% 時給出秒數，命中不足時 seconds 為 null", () => {
    const data = makeData();
    const { attacker, normalAttack } = buildCombatant(makeState(), data);
    const easy = killEstimate(attacker, data.monsters[5407], null, normalAttack.castTicks);
    expect(easy.hitPct).toBe(100);
    expect(easy.seconds).toBeGreaterThan(3);
    const hard = killEstimate(
      { ...attacker, hit: 0 },
      { ...data.monsters[5407], baseDodge: 200 },
      null,
      normalAttack.castTicks,
    );
    expect(hard.hitPct).toBe(0);
    expect(hard.seconds).toBeNull();
  });
});

describe("attackFrameIndex", () => {
  const delays = [6, 6, 6, 6];
  it("週期夠長：照原速，命中格（索引 2）從命中時刻開始", () => {
    expect(attackFrameIndex(delays, 0, 25)).toBe(-1);
    expect(attackFrameIndex(delays, 12, 25)).toBe(-1);
    expect(attackFrameIndex(delays, 13, 25)).toBe(0);
    expect(attackFrameIndex(delays, 24, 25)).toBe(1);
    expect(attackFrameIndex(delays, 25, 25)).toBe(2);
    expect(attackFrameIndex(delays, 31, 25)).toBe(3);
    expect(attackFrameIndex(delays, 37, 25)).toBe(-1);
  });

  it("週期太短：整段加快，命中格仍然在命中時刻開始", () => {
    expect(attackFrameIndex(delays, 0, 7)).toBe(0);
    expect(attackFrameIndex(delays, 4, 7)).toBe(1);
    expect(attackFrameIndex(delays, 7, 7)).toBe(2);
    expect(attackFrameIndex(delays, 11, 7)).toBe(3);
  });
});

describe("離線摘要", () => {
  const base: IdleSummary = {
    ticks: 60 * 60 * 60,
    kills: 10,
    exp: 0,
    money: 0,
    hits: 0,
    misses: 0,
    damage: 0,
    levelBefore: 1,
    levelAfter: 2,
    levelUps: 1,
    pointsGained: 3,
    blocked: false,
  };
  it("太短或沒事發生不打擾", () => {
    expect(offlineWorthShowing(base)).toBe(true);
    expect(offlineWorthShowing({ ...base, ticks: 60 * 30 })).toBe(false);
    expect(offlineWorthShowing({ ...base, kills: 0 })).toBe(false);
    expect(offlineWorthShowing({ ...base, kills: 0, blocked: true })).toBe(true);
  });
  it("時間文字與上限", () => {
    expect(formatOfflineDuration({ ticks: 90 * 60 * 60 })).toEqual({ text: "1 小時 30 分", capped: false });
    expect(formatOfflineDuration({ ticks: 20 * 60 * 60 }).text).toBe("20 分鐘");
    const cap = Math.floor((12 * 3600 * 1000) / (1000 / 60));
    expect(formatOfflineDuration({ ticks: cap })).toEqual({ text: "12 小時", capped: true });
    expect(ticksToMs(60)).toBeCloseTo(1000, 6);
  });
});
