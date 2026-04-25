import { describe, it, expect } from "vitest";
import { computeCumulative, type CumulativeRow } from "../awakening-cost";
import type { AwakeningStage } from "@/lib/types/awakening";

function stage(n: number, money: number, prob: number, mat = "十星覺醒符"): AwakeningStage {
  return {
    stage: n,
    money,
    materialId: 0,
    materialName: mat,
    materialAmount: 1,
    successProb: prob,
    bonuses: [{ bonusType: "ITEM_BONUS_DEF", label: "防禦", value: n * 2 }],
  };
}

describe("computeCumulative", () => {
  it("returns empty array for empty input", () => {
    expect(computeCumulative([])).toEqual([]);
  });

  it("best == expected when successProb is 1", () => {
    const out = computeCumulative([stage(1, 100_000, 1), stage(2, 300_000, 1)]);
    expect(out[0].cumulativeBest).toBe(100_000);
    expect(out[0].cumulativeExpected).toBe(100_000);
    expect(out[1].cumulativeBest).toBe(400_000);
    expect(out[1].cumulativeExpected).toBe(400_000);
  });

  it("expected scales by 1/p when prob < 1", () => {
    const out = computeCumulative([stage(1, 1_000_000, 0.5)]);
    expect(out[0].cumulativeBest).toBe(1_000_000);
    expect(out[0].cumulativeExpected).toBeCloseTo(2_000_000, 0);
  });

  it("matches the spec sanity-check for 200鞋 (best=103.9M, expected≈1.17B)", () => {
    const data: Array<[number, number, number, string]> = [
      [1, 100_000, 1.0, "十星覺醒符"],
      [2, 300_000, 1.0, "十星覺醒符"],
      [3, 500_000, 0.9, "十星覺醒符"],
      [4, 1_000_000, 0.8, "十星覺醒符"],
      [5, 2_000_000, 0.7, "十星覺醒符"],
      [6, 3_000_000, 0.6, "十星覺醒符"],
      [7, 3_500_000, 0.5, "十星覺醒符"],
      [8, 4_000_000, 0.4, "十星覺醒符"],
      [9, 4_500_000, 0.3, "十星覺醒符"],
      [10, 5_000_000, 0.2, "十星覺醒符"],
      [11, 5_500_000, 0.2, "突破覺醒符"],
      [12, 6_000_000, 0.2, "突破覺醒符"],
      [13, 6_500_000, 0.15, "突破覺醒符"],
      [14, 7_000_000, 0.1, "突破覺醒符"],
      [15, 7_500_000, 0.05, "突破覺醒符"],
      [16, 8_000_000, 0.2, "超越覺醒符"],
      [17, 8_500_000, 0.15, "超越覺醒符"],
      [18, 9_000_000, 0.1, "超越覺醒符"],
      [19, 10_000_000, 0.05, "超越覺醒符"],
      [20, 12_000_000, 0.03, "超越覺醒符"],
    ];
    const stages = data.map(([n, m, p, mat]) => stage(n, m, p, mat));
    const out = computeCumulative(stages);
    const last = out[out.length - 1];
    expect(last.cumulativeBest).toBe(103_900_000);
    expect(last.cumulativeExpected).toBeGreaterThan(1_150_000_000);
    expect(last.cumulativeExpected).toBeLessThan(1_200_000_000);
  });

  it("groups cumulative material counts by name", () => {
    const out = computeCumulative([
      stage(1, 100_000, 1, "十星覺醒符"),
      stage(2, 300_000, 1, "十星覺醒符"),
      stage(3, 500_000, 0.9, "突破覺醒符"),
    ]);
    expect(out[0].cumulativeMaterials).toEqual({ 十星覺醒符: 1 });
    expect(out[1].cumulativeMaterials).toEqual({ 十星覺醒符: 2 });
    expect(out[2].cumulativeMaterials).toEqual({ 十星覺醒符: 2, 突破覺醒符: 1 });
  });

  it("treats successProb=0 as +Infinity expected (avoid div-by-zero)", () => {
    const out = computeCumulative([stage(1, 1_000_000, 0)]);
    expect(out[0].cumulativeExpected).toBe(Infinity);
  });
});

describe("CumulativeRow type fields", () => {
  it("exposes stage and per-stage money/prob alongside cumulatives", () => {
    const out = computeCumulative([stage(1, 100, 1)]);
    const row: CumulativeRow = out[0];
    expect(row.stage).toBe(1);
    expect(row.stageMoney).toBe(100);
    expect(row.stageProb).toBe(1);
    expect(row.cumulativeBest).toBe(100);
    expect(row.cumulativeExpected).toBe(100);
    expect(row.cumulativeMaterials).toEqual({ 十星覺醒符: 1 });
    expect(row.materialName).toBe("十星覺醒符");
    expect(row.materialAmount).toBe(1);
    expect(row.bonuses[0].label).toBe("防禦");
  });
});
