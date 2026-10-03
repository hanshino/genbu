import { describe, expect, it } from "vitest";
import { ELITE_HP_RATIO, computeHpRatios, isEliteRatio } from "../elite";

describe("computeHpRatios", () => {
  it("以其他物種 hp 的中位數為分母", () => {
    const ratios = computeHpRatios([
      { npcId: 1, hp: 100 },
      { npcId: 2, hp: 200 },
      { npcId: 3, hp: 3000 },
    ]);
    expect(ratios.get(3)).toBe(3000 / 150); // 其他兩隻中位數 (100+200)/2
    expect(ratios.get(1)).toBe(100 / 1600);
  });

  it("只有一個合格物種時無法比較", () => {
    const ratios = computeHpRatios([
      { npcId: 1, hp: 100 },
      { npcId: 2, hp: null },
    ]);
    expect(ratios.get(1)).toBeNull();
    expect(ratios.get(2)).toBeNull();
  });

  it("重複的 npcId 只算一次，不被 row 數加權", () => {
    const ratios = computeHpRatios([
      { npcId: 1, hp: 100 },
      { npcId: 1, hp: 100 },
      { npcId: 1, hp: 100 },
      { npcId: 2, hp: 1000 },
    ]);
    expect(ratios.get(2)).toBe(10);
  });
});

describe("isEliteRatio", () => {
  it(`倍數 >= ${ELITE_HP_RATIO} 才是菁英`, () => {
    expect(isEliteRatio(ELITE_HP_RATIO)).toBe(true);
    expect(isEliteRatio(ELITE_HP_RATIO - 0.01)).toBe(false);
    expect(isEliteRatio(null)).toBe(false);
  });
});
