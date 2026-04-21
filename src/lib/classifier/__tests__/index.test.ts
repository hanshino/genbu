import { describe, it, expect } from "vitest";
import { classify } from "../index";

describe("classify (Phase 2 stub)", () => {
  it("returns empty array", () => {
    const result = classify({
      item: { id: 1 } as never,
      rands: [],
    });
    expect(result).toEqual([]);
  });
});
