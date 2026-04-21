import { describe, it, expect } from "vitest";
import { labelToKey, knownRandLabels } from "../attribute-alias";

describe("labelToKey", () => {
  it("resolves every rand attribute label observed in production data", () => {
    // Labels actually present in item_rand for 座騎+背飾 (measured from DB)
    const observed = [
      "內力", "內勁", "外功", "技巧", "根骨", "物攻",
      "玄學", "真氣", "護勁", "身法", "重擊", "防禦", "體力",
    ];
    for (const label of observed) {
      expect(labelToKey(label), `${label} should resolve`).not.toBeNull();
    }
  });

  it("maps 外功 → str", () => { expect(labelToKey("外功")).toBe("str"); });
  it("maps 技巧 → dex", () => { expect(labelToKey("技巧")).toBe("dex"); });
  it("maps 內力 → pow", () => { expect(labelToKey("內力")).toBe("pow"); });
  it("maps 物攻 → atk", () => { expect(labelToKey("物攻")).toBe("atk"); });
  it("returns null for unknown labels", () => {
    expect(labelToKey("中二屬性")).toBeNull();
  });

  it("exposes the full set of known labels for docs/diagnostics", () => {
    expect(knownRandLabels.length).toBeGreaterThan(10);
    expect(knownRandLabels).toContain("外功");
  });
});
