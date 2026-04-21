import { describe, it, expect } from "vitest";
import { presets, getPresetById, getPresetByLabel } from "../presets";

// Snapshot of LINE bot's weighted.config.js at the time of porting
// (../tthol-line-bot/src/configs/weighted.config.js).
const lineBotConfig = [
  { type: "純玄系列", params: [
    { key: "wis", value: 7 }, { key: "dex", value: 3 }, { key: "hit", value: 1 },
    { key: "def", value: 0.5 }, { key: "mdef", value: 0.25 },
  ]},
  { type: "純外系列", params: [
    { key: "str", value: 11 }, { key: "atk", value: 1 }, { key: "dex", value: 3 },
    { key: "hit", value: 1 }, { key: "def", value: 0.5 }, { key: "mdef", value: 0.5 },
  ]},
  { type: "純內系列", params: [
    { key: "pow", value: 9 }, { key: "matk", value: 1 }, { key: "dex", value: 3 },
    { key: "hit", value: 1 }, { key: "def", value: 0.5 }, { key: "mdef", value: 0.5 },
  ]},
  { type: "玄內系列", params: [
    { key: "wis", value: 7 }, { key: "pow", value: 5 }, { key: "matk", value: 1 },
    { key: "dex", value: 3 }, { key: "hit", value: 1 }, { key: "def", value: 0.5 },
    { key: "mdef", value: 0.25 },
  ]},
  { type: "玄外系列", params: [
    { key: "wis", value: 7 }, { key: "str", value: 5 }, { key: "atk", value: 1 },
    { key: "dex", value: 3 }, { key: "hit", value: 1 }, { key: "def", value: 0.5 },
    { key: "mdef", value: 0.5 },
  ]},
  { type: "爆刀", params: [
    { key: "agi", value: 7 }, { key: "str", value: 7 }, { key: "critical", value: 5 },
    { key: "def", value: 0.75 }, { key: "mdef", value: 0.75 },
  ]},
  { type: "手甲", params: [
    { key: "dex", value: 15 }, { key: "hit", value: 5 }, { key: "atk", value: 7 },
  ]},
];

describe("presets parity with LINE bot weighted.config.js", () => {
  // Every LINE bot preset must remain present with identical weights;
  // genbu-only additions (extras) are allowed.
  it("includes every LINE bot preset", () => {
    for (const cfg of lineBotConfig) {
      expect(
        presets.find((p) => p.label === cfg.type),
        `preset ${cfg.type}`
      ).toBeDefined();
    }
  });

  for (const cfg of lineBotConfig) {
    it(`${cfg.type} has identical weights`, () => {
      const p = presets.find((x) => x.label === cfg.type);
      expect(p, `preset labelled ${cfg.type}`).toBeDefined();
      const expected: Record<string, number> = {};
      for (const { key, value } of cfg.params) expected[key] = value;
      expect(p!.weights).toEqual(expected);
    });
  }
});

describe("preset lookup helpers", () => {
  it("finds by id", () => {
    expect(getPresetById("pure-str")?.label).toBe("純外系列");
  });
  it("finds by label", () => {
    expect(getPresetByLabel("手甲")?.id).toBe("gauntlet");
  });
  it("returns null for missing", () => {
    expect(getPresetById("nope")).toBeNull();
  });
});
