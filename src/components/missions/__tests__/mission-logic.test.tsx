import { describe, expect, it } from "vitest";
import { buildFlowRows, cnNumber, formatTimer } from "../mission-logic";
import type { MissionStep } from "@/lib/types/mission";

const step = (index: number) => ({ index, rawText: `s${index}`, maps: [] }) as unknown as MissionStep;
const flow = (s: number) => ({ step: s, npcs: ["A"], dialogue: null });

describe("mission-logic helpers", () => {
  it("formats timers in 時辰 and 遊戲天", () => {
    expect(formatTimer(30)).toBe("30 分（3 時辰）");
    expect(formatTimer(360)).toBe("360 分（36 時辰，約 3 遊戲天）");
  });

  it("numbers tabs in Chinese", () => {
    expect([1, 10, 11, 20, 47].map(cnNumber)).toEqual(["一", "十", "十一", "二十", "四十七"]);
  });

  it("aligns flow step N with mission step N+1 and appends completion", () => {
    const rows = buildFlowRows([step(1), step(2), step(3)], [flow(0), flow(1), flow(15)]);
    expect(rows.map((r) => [r.kind, r.index, r.step?.index ?? null, r.flow?.step ?? null])).toEqual([
      ["accept", 1, 1, 0],
      ["step", 2, 2, 1],
      ["step", 3, 3, null],
      ["complete", 15, null, 15],
    ]);
    expect(buildFlowRows([], [])).toEqual([]);
  });
});
