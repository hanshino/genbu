import { describe, expect, it } from "vitest";
import { gameIntervalNote } from "../skill-detail";

describe("gameIntervalNote", () => {
  it("遊戲只留一位小數、捨去：450 → 0.4 秒，1550 → 1.5 秒", () => {
    expect(gameIntervalNote(450)).toBe("遊戲顯示 0.4 秒");
    expect(gameIntervalNote(550)).toBe("遊戲顯示 0.5 秒");
    expect(gameIntervalNote(1550)).toBe("遊戲顯示 1.5 秒");
    expect(gameIntervalNote(2050)).toBe("遊戲顯示 2 秒");
  });

  it("整百毫秒跟遊戲一致，不補說明", () => {
    expect(gameIntervalNote(400)).toBeNull();
    expect(gameIntervalNote(1000)).toBeNull();
  });
});
