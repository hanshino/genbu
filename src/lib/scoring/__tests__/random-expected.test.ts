import { describe, it, expect } from "vitest";
import { expectedRandom } from "../random-expected";
import type { ItemRand } from "@/lib/types/item";

const mkRand = (attr: string, min: number, max: number, rate: number): ItemRand => ({
  id: "1",
  attribute: attr,
  min,
  max,
  rate,
});

describe("expectedRandom", () => {
  it("returns empty object when there are no rand rows", () => {
    expect(expectedRandom([])).toEqual({});
  });

  it("matches the spec example for item 22074 (外功 4.06)", () => {
    // From spec §3.2: 外功 with (3~5 @ rate 970000) and (6~6 @ rate 30000)
    // totalRate = 1_000_000
    // E[str] = 4 * 0.97 + 6 * 0.03 = 3.88 + 0.18 = 4.06
    const rands = [
      mkRand("外功", 3, 5, 970000),
      mkRand("外功", 6, 6, 30000),
    ];
    const e = expectedRandom(rands);
    expect(e.str).toBeCloseTo(4.06, 4);
  });

  it("handles multiple attributes within a single item", () => {
    // item has both 外功 and 技巧 random pools; each is guaranteed for this
    // item (it rolls one of each), so totalRate spans both attributes.
    const rands = [
      mkRand("外功", 2, 4, 500000),   // E[str contribution] = 3 * 0.5 = 1.5
      mkRand("技巧", 1, 3, 500000),   // E[dex contribution] = 2 * 0.5 = 1.0
    ];
    const e = expectedRandom(rands);
    expect(e.str).toBeCloseTo(1.5, 4);
    expect(e.dex).toBeCloseTo(1.0, 4);
  });

  it("ignores unknown attribute labels (does not throw)", () => {
    const rands = [
      mkRand("外功", 1, 3, 500000),
      mkRand("虛構屬性", 1, 3, 500000),
    ];
    const e = expectedRandom(rands);
    expect(e.str).toBeCloseTo(2 * 0.5, 4);
    // Unknown label contributes nothing to output keys.
    expect(Object.keys(e)).toEqual(["str"]);
  });

  it("returns empty object when totalRate is 0 (defensive)", () => {
    const rands = [mkRand("外功", 1, 5, 0)];
    expect(expectedRandom(rands)).toEqual({});
  });
});
