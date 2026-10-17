import { describe, expect, it } from "vitest";
import { canChangeJob, isJobChangeSect } from "../job";

describe("canChangeJob", () => {
  it("只有 Lv9 以上的入門弟子持有轉職證書", () => {
    expect(canChangeJob({ sectId: 1, level: 8 })).toBe(false);
    expect(canChangeJob({ sectId: 1, level: 9 })).toBe(true);
    expect(canChangeJob({ sectId: 1, level: 30 })).toBe(true);
    expect(canChangeJob({ sectId: 4, level: 30 })).toBe(false);
  });

  it("只能轉入惡人谷、移花宮、天外天", () => {
    expect([1, 2, 4, 8, 16, "4", null].map(isJobChangeSect)).toEqual([false, true, true, true, false, false, false]);
  });
});
