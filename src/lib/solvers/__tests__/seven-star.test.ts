import { describe, it, expect } from "vitest";
import { solveSevenStar, sevenStarToNumber } from "../seven-star";

describe("solveSevenStar", () => {
  it("maps number to 7 booleans with star 1 = LSB", () => {
    // 85 = 0b1010101 -> [LSB..MSB] = [1,0,1,0,1,0,1]
    expect(solveSevenStar(85)).toEqual([true, false, true, false, true, false, true]);
  });

  it("handles min value 1", () => {
    expect(solveSevenStar(1)).toEqual([true, false, false, false, false, false, false]);
  });

  it("handles max value 127", () => {
    expect(solveSevenStar(127)).toEqual([true, true, true, true, true, true, true]);
  });

  it("handles 0 (all off) — range clamping is UI's job, solver is total", () => {
    expect(solveSevenStar(0)).toEqual([false, false, false, false, false, false, false]);
  });
});

describe("sevenStarToNumber", () => {
  it("reverses solveSevenStar for 1..127", () => {
    for (let n = 1; n <= 127; n++) {
      const state = solveSevenStar(n);
      expect(sevenStarToNumber(state)).toBe(n);
    }
  });
});
