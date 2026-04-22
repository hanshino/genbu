import { describe, it, expect } from "vitest";
import { scoreItem } from "../score";
import type { Item, ItemRand } from "@/lib/types/item";

// Helper: build an Item with only the fields that matter, zero for others
function mkItem(partial: Partial<Item>): Item {
  const base: Item = {
    id: 1,
    name: "T",
    note: null,
    type: "座騎",
    summary: null,
    level: 80,
    weight: 0,
    hp: 0,
    mp: 0,
    str: 0,
    pow: 0,
    vit: 0,
    dex: 0,
    agi: 0,
    wis: 0,
    atk: 0,
    matk: 0,
    def: 0,
    mdef: 0,
    dodge: 0,
    uncanny_dodge: 0,
    critical: 0,
    hit: 0,
    speed: 0,
    fire: 0,
    water: 0,
    thunder: 0,
    tree: 0,
    freeze: 0,
    min_damage: 0,
    max_damage: 0,
    min_pdamage: 0,
    max_pdamage: 0,
    picture: 0,
    icon: 0,
    value: 0,
    durability: 0,
  };
  return { ...base, ...partial };
}

const noRand: ItemRand[] = [];

describe("scoreItem", () => {
  it("sums weighted fixed attributes", () => {
    const item = mkItem({ str: 10, dex: 5, hit: 8 });
    const weights = { str: 11, dex: 3, hit: 1 };
    const scored = scoreItem(item, noRand, weights);
    expect(scored.baseScore).toBe(10 * 11 + 5 * 3 + 8 * 1); // 133
    expect(scored.score).toBe(133);
    expect(scored.expectedRandom).toEqual({});
  });

  it("adds random expectations multiplied by matching weights", () => {
    const item = mkItem({ str: 10 });
    const rands: ItemRand[] = [
      { id: "1", attribute: "外功", min: 3, max: 5, rate: 970000 },
      { id: "1", attribute: "外功", min: 6, max: 6, rate: 30000 },
    ];
    // E[str] = 4.06
    // baseScore = 10 * 11 = 110
    // score    = 110 + 4.06 * 11 = 154.66
    const scored = scoreItem(item, rands, { str: 11 });
    expect(scored.baseScore).toBe(110);
    expect(scored.expectedRandom.str).toBeCloseTo(4.06, 4);
    expect(scored.score).toBeCloseTo(154.66, 2);
  });

  it("ignores weight keys that do not exist on the item (no throw)", () => {
    const item = mkItem({ str: 10 });
    const scored = scoreItem(item, noRand, { str: 2, not_a_real_key: 99 });
    expect(scored.score).toBe(20);
  });

  it("handles negative weights (subtraction)", () => {
    const item = mkItem({ str: 10, weight: 50 });
    const scored = scoreItem(item, noRand, { str: 1, weight: -0.5 });
    expect(scored.score).toBe(10 - 25); // -15
  });

  it("empty weights yields zero score", () => {
    const item = mkItem({ str: 100 });
    const scored = scoreItem(item, noRand, {});
    expect(scored.score).toBe(0);
  });
});
