import { describe, it, expect } from "vitest";
import { randomNpcName } from "./npc-names";

describe("randomNpcName", () => {
  it("回傳純中文、2–5 字的名字", () => {
    const names = Array.from({ length: 50 }, randomNpcName);
    for (const name of names) expect(name).toMatch(/^[一-龥]{2,5}$/);
    expect(new Set(names).size).toBeGreaterThan(1); // 真的有隨機
  });
});
