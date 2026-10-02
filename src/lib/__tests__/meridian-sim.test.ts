import { describe, expect, it } from "vitest";
import { getMeridianData } from "@/lib/queries/meridian";
import type { MeridianLevels } from "@/lib/types/meridian";
import {
  INITIAL_LEVELS, EXP_PER_DANTIAN_BASE, QI_MAX, STAT_LABELS,
  formatStat, indexPoints, levelOf, missingPrereqs, raiseTo, lowerTo, fillAll,
  sumStats, probBonus, expDiscount, expPerDantian, effectiveProb, costBetween,
  waterIconId, initialPlayState, convertExp, attemptBreak,
} from "../meridian-sim";

const data = getMeridianData();
const idx = indexPoints(data.points);

function expectLegal(levels: MeridianLevels) {
  for (const point of data.points) {
    for (let level = 1; level <= levelOf(levels, point.id); level++) {
      expect(missingPrereqs(idx, levels, point.id, level)).toEqual([]);
    }
  }
}

describe("經脈規劃（真 DB）", () => {
  it("indexPoints、levelOf 與逐級學的隱含前置", () => {
    expect(idx.size).toBe(55);
    expect(levelOf({}, 855)).toBe(0);
    expect(missingPrereqs(idx, INITIAL_LEVELS, 855, 3)).toEqual([{ id: 855, level: 2 }]);
    expect(missingPrereqs(idx, {}, 930, 1)).toEqual([{ id: 855, level: 1 }]);
  });

  it("每個穴位上推到滿級後，各級前置皆滿足且不 mutate", () => {
    const initial = Object.freeze({ ...INITIAL_LEVELS });
    for (const point of data.points) {
      const raised = raiseTo(idx, initial, point.id, point.maxLevel);
      expect(raised).not.toBe(initial);
      expect(levelOf(raised, point.id)).toBe(point.maxLevel);
      expectLegal(raised);
    }
    expect(initial).toEqual({ 855: 1 });
  });

  it("全滿總花費 10161，期望花費以原始成功率保守估計", () => {
    const full = fillAll(idx);
    expectLegal(full);
    const cost = costBetween(idx, INITIAL_LEVELS, full);
    expect(cost.min).toBe(10161);
    expect(cost.levels).toBe(484);
    expect(cost.expected).toBeGreaterThan(cost.min);
    expect(costBetween(idx, INITIAL_LEVELS, { 855: 3 })).toEqual({
      min: 20, expected: 5 / 0.8 + 15 / 0.6, levels: 2,
    });
    expect(costBetween(idx, {}, INITIAL_LEVELS)).toEqual({ min: 0, expected: 0, levels: 0 });
    expect(costBetween(idx, full, full)).toEqual({ min: 0, expected: 0, levels: 0 });
    expect(() => costBetween(idx, full, INITIAL_LEVELS)).toThrow(RangeError);
  });

  it("逐級加總 Dodge 300、Hit 300、HP 1250、EnemyDef 5，保留 flag 並排除零", () => {
    const stats = sumStats(idx, fillAll(idx));
    expect(stats).toEqual(expect.arrayContaining([
      { stat: "Dodge", value: 300, flag: "AFFECT_NUMBER" },
      { stat: "Hit", value: 300, flag: "AFFECT_NUMBER" },
      { stat: "HP", value: 1250, flag: "AFFECT_NUMBER" },
      { stat: "EnemyDef", value: 5, flag: "AFFECT_RATIO" },
    ]));
    expect(stats.every((stat) => stat.value !== 0)).toBe(true);
    expect(sumStats(idx, {})).toEqual([]);
    expect(new Set(stats.map((stat) => stat.stat)).size).toBe(stats.length);
  });

  it("神道降到 0，下推所有依賴穴位，保留其他脈且整體仍合法", () => {
    const full = Object.freeze(fillAll(idx));
    const lowered = lowerTo(idx, full, 930, 0);
    const dependents = new Set([930]);
    let changed: boolean;
    do {
      changed = false;
      for (const point of data.points) {
        if (!dependents.has(point.id) && point.levels.some((level) =>
          level.prereqs.some((req) => dependents.has(req.id)))) {
          dependents.add(point.id);
          changed = true;
        }
      }
    } while (changed);
    expect(dependents.size).toBeGreaterThan(1);
    for (const id of dependents) expect(levelOf(lowered, id)).toBe(0);
    for (const point of data.points.filter((point) => !dependents.has(point.id))) {
      expect(levelOf(lowered, point.id)).toBe(point.maxLevel);
    }
    expectLegal(lowered);
    expect(full).toEqual(fillAll(idx));
  });

  it("承漿不可低於 1，部分降級保留合法的最高級", () => {
    expect(lowerTo(idx, INITIAL_LEVELS, 855, 0)[855]).toBe(1);
    expectLegal(lowerTo(idx, fillAll(idx), 855, 0));
    const lowered = lowerTo(idx, fillAll(idx), 930, 1);
    expect(lowered[930]).toBe(1);
    expectLegal(lowered);
  });

  it("經驗折扣與成功率加成由當下配置計算", () => {
    expect(expPerDantian(idx, {})).toBe(EXP_PER_DANTIAN_BASE);
    expect(expDiscount(idx, { 855: 3 })).toBe(3);
    expect(expPerDantian(idx, { 855: 3 })).toBe(97_000_000);
    const bonusLevels = raiseTo(idx, INITIAL_LEVELS, 865, 5);
    expect(probBonus(idx, bonusLevels)).toBeGreaterThan(0);
    expect(effectiveProb(99, 10)).toBe(100);
    expect(effectiveProb(60, 5)).toBe(65);
  });

  it("拒絕不存在的穴位、非整數與越界等級", () => {
    expect(() => raiseTo(idx, INITIAL_LEVELS, -1, 1)).toThrow(RangeError);
    expect(() => raiseTo(idx, INITIAL_LEVELS, 855, 6)).toThrow(RangeError);
    expect(() => lowerTo(idx, INITIAL_LEVELS, 855, -1)).toThrow(RangeError);
    expect(() => missingPrereqs(idx, INITIAL_LEVELS, 855, 1.5)).toThrow(RangeError);
  });
});

describe("經脈體驗（固定 rng）", () => {
  it("失敗照扣丹田、氣海 +1，累計與最新 log 正確且不 mutate", () => {
    const state = initialPlayState();
    const before = structuredClone(state);
    const result = attemptBreak(idx, state, 855, () => 0.99);
    expect(result.outcome).toBe("fail");
    expect(result.state).toMatchObject({
      levels: INITIAL_LEVELS, dantian: 495, qi: 1, spentDantian: 5,
      attempts: 1, successes: 0, failures: 1,
      log: [{ id: 855, level: 2, ok: false, cost: 5, guaranteed: false }],
    });
    expect(state).toEqual(before);
  });

  it("氣海滿保證成功並歸零，不呼叫 rng", () => {
    const state = { ...initialPlayState(), qi: QI_MAX };
    const result = attemptBreak(idx, state, 855, () => { throw new Error("不應抽籤"); });
    expect(result.outcome).toBe("success");
    expect(result.state).toMatchObject({
      levels: { 855: 2 }, qi: 0, dantian: 495, attempts: 1, successes: 1, failures: 0,
      log: [{ id: 855, level: 2, ok: true, cost: 5, guaranteed: true }],
    });
    expect(state.qi).toBe(100);
  });

  it("正常成功保留氣海、扣費且成功率包含當下加成", () => {
    const state = { ...initialPlayState(), qi: 12, levels: raiseTo(idx, INITIAL_LEVELS, 865, 1) };
    const result = attemptBreak(idx, state, 855, () => 0.8);
    expect(result.outcome).toBe("success");
    expect(result.state.qi).toBe(12);
    expect(result.state.levels[855]).toBe(2);
    expect(result.state.dantian).toBe(state.dantian - 5);
    expect(attemptBreak(idx, initialPlayState(), 855, () => 0.8).outcome).toBe("fail");
  });

  it("丹田不足、缺前置、任務級與滿級均 blocked 且不更動 state", () => {
    const cases = [
      { state: initialPlayState(4), id: 855, reason: "dantian" },
      { state: { ...initialPlayState(), qi: 100, levels: {} }, id: 930, reason: "prereq" },
      { state: { ...initialPlayState(), levels: {} }, id: 855, reason: "quest" },
      { state: { ...initialPlayState(), levels: { 855: 5 } }, id: 855, reason: "max" },
    ];
    for (const { state, id, reason } of cases) {
      expect(attemptBreak(idx, state, id, () => { throw new Error("blocked 不應抽籤"); }))
        .toEqual({ state, outcome: "blocked", reason });
    }
  });

  it("log 新的在前，最多 50 筆", () => {
    let state = initialPlayState(500);
    for (let i = 0; i < 55; i++) state = attemptBreak(idx, state, 855, () => 0.99).state;
    expect(state.log).toHaveLength(50);
    expect(state.attempts).toBe(55);
    const next = attemptBreak(idx, state, 855, () => 0).state;
    expect(next.log).toHaveLength(50);
    expect(next.log[0].ok).toBe(true);
    expect(next.log[1].ok).toBe(false);
  });

  it("轉丹田用當下折扣，不 mutate 輸入，初始配置彼此獨立", () => {
    const state = { ...initialPlayState(10), levels: { 855: 3 } };
    const before = structuredClone(state);
    expect(convertExp(idx, state, 2)).toMatchObject({
      dantian: 12, spentExp: 194_000_000, converted: 2,
    });
    expect(state).toEqual(before);
    expect(initialPlayState().dantian).toBe(500);
    expect(initialPlayState().levels).not.toBe(INITIAL_LEVELS);
    expect(initialPlayState().levels).not.toBe(initialPlayState().levels);
    expect(() => convertExp(idx, state, -1)).toThrow(RangeError);
    expect(() => convertExp(idx, state, 0.5)).toThrow(RangeError);
    expect(() => initialPlayState(-1)).toThrow(RangeError);
  });
});

describe("格式與氣海水球", () => {
  it("中文名稱、百分比、恢復間隔與經驗降低", () => {
    for (const point of data.points) {
      for (const level of point.levels) {
        for (const stat of level.stats) expect(STAT_LABELS[stat.stat]).toBeTruthy();
      }
    }
    expect(formatStat("Dodge", 300, "AFFECT_NUMBER")).toBe("閃躲 +300");
    expect(formatStat("EnemyDef", 5, "AFFECT_RATIO")).toBe("減少敵方防禦 5%");
    expect(formatStat("HPRecover", 5, "AFFECT_NUMBER")).toBe("體力恢復間隔 −5 秒");
    expect(formatStat("MPRecover", 3, "AFFECT_NUMBER")).toBe("真氣恢復間隔 −3 秒");
    expect(formatStat("AtribChanlExp", 3, "AFFECT_RATIO")).toBe("經脈消耗經驗值 −3%");
    expect(formatStat("AtribChanlProb", 10, "AFFECT_RATIO")).toBe("穴位打通成功率 +10%");
    expect(formatStat("Unknown", -2, null)).toBe("Unknown −2");
  });

  it.each([
    [0, 1295], [1, 1296], [14, 1296], [15, 1297], [31, 1297], [32, 1298],
    [48, 1298], [49, 1299], [65, 1299], [66, 1300], [82, 1300], [83, 1301],
    [99, 1301], [100, 1302], [101, 1302],
  ])("氣海 %i → icon %i", (qi, icon) => {
    expect(waterIconId(qi)).toBe(icon);
  });
});
