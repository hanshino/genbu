import { describe, expect, it, vi } from "vitest";
import {
  createDefaultCharacter,
  duplicateCharacter,
  parseCharacter,
  parseCharacterStore,
} from "../stat-character";
import { EQUIP_SLOTS, type CharacterStore, type CharacterV1 } from "../types/stat-sim";

function store(character = createDefaultCharacter()): CharacterStore {
  return { version: 1, activeCharacterId: character.id, characters: [character] };
}

describe("stat-character", () => {
  it("creates independent level-one defaults with all equipment slots", () => {
    const character = createDefaultCharacter();
    expect(character).toMatchObject({
      version: 1,
      name: "新角色",
      sectId: 2,
      level: 1,
      rebirthPoints: 0,
      attributes: { str: 1, pow: 1, vit: 1, agi: 1, dex: 1, wis: 1 },
      subSects: [],
      passiveLevels: {},
      meridianPlan: null,
      manual: { hero: {}, formation: {} },
    });
    expect(Object.keys(character.equipment)).toEqual(EQUIP_SLOTS);
    expect(Object.values(character.equipment).every((item) => item === null)).toBe(true);
    const second = createDefaultCharacter("麒麟", 8192);
    expect(second).toMatchObject({ name: "麒麟", sectId: 8192 });
    expect(second.id).not.toBe(character.id);
    expect(parseCharacter(character)).toEqual({ ok: true, character });
  });

  it("uses an id fallback when randomUUID is unavailable", () => {
    vi.stubGlobal("crypto", {});
    try {
      const first = createDefaultCharacter();
      expect(first.id).toBeTruthy();
      expect(createDefaultCharacter().id).not.toBe(first.id);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("deep-copies every nested field when duplicating", () => {
    const original = createDefaultCharacter("本尊");
    original.equipment.right = { itemId: 123, enhancementLevel: 30, manualBonuses: { atk: 5 } };
    original.passiveLevels[1151] = 3;
    original.rebirthLevels = [100];
    original.subSects = ["CLASS_GOD"];
    original.manual.hero.hp = 10;
    const copy = duplicateCharacter(original);
    expect(copy.id).not.toBe(original.id);
    expect(copy.name).toBe("本尊（副本）");
    expect(parseCharacter(copy).ok).toBe(true);
    copy.attributes.str = 20;
    copy.equipment.right!.manualBonuses.atk = 99;
    copy.passiveLevels[1151] = 10;
    copy.rebirthLevels![0] = 140;
    copy.subSects.push("CLASS_ISLE");
    copy.manual.hero.hp = 100;
    expect(original.attributes.str).toBe(1);
    expect(original.equipment.right!.manualBonuses.atk).toBe(5);
    expect(original.passiveLevels[1151]).toBe(3);
    expect(original.rebirthLevels).toEqual([100]);
    expect(original.subSects).toEqual(["CLASS_GOD"]);
    expect(original.manual.hero.hp).toBe(10);
  });

  it("accepts populated data and preserves fractional/negative manual bonuses", () => {
    const character = createDefaultCharacter("測試", 4096);
    character.level = 198;
    character.rebirthPoints = 140;
    character.rebirthLevels = [100, 110, 130, 140];
    character.subSects = ["CLASS_GOD", "CLASS_SHAULIN"];
    character.equipment.right = { itemId: 100, enhancementLevel: 30, manualBonuses: { atk: -1.5 } };
    character.manual = { hero: { hp: 12.5 }, formation: { def: -3 } };
    character.passiveLevels = { 13: 0, 1151: 10 };
    character.meridianPlan = "1.2.3";
    expect(parseCharacterStore(store(character))).toEqual({ ok: true, store: store(character) });
  });

  it.each([0, 1, 9, 10, 140])("accepts the specified rebirthPoints storage range: %s", (points) => {
    expect(parseCharacter({ ...createDefaultCharacter(), rebirthPoints: points }).ok).toBe(true);
  });

  it.each([2, 4, 8, 512, 2048, 4096, 8192])("accepts sectId %s", (sectId) => {
    expect(parseCharacter({ ...createDefaultCharacter(), sectId }).ok).toBe(true);
  });

  const invalidCases: [string, (c: CharacterV1) => unknown][] = [
    ["null", () => null],
    ["array", () => []],
    ["non-JSON object", () => new Date()],
    ["missing version", (c) => ({ ...c, version: undefined })],
    ["old version", (c) => ({ ...c, version: 0 })],
    ["string version", (c) => ({ ...c, version: "1" })],
    ["empty id", (c) => ({ ...c, id: "" })],
    ["numeric name", (c) => ({ ...c, name: 1 })],
    ["unsupported sect", (c) => ({ ...c, sectId: 16 })],
    ["string sect", (c) => ({ ...c, sectId: "2" })],
    ["zero level", (c) => ({ ...c, level: 0 })],
    ["fractional level", (c) => ({ ...c, level: 1.5 })],
    ["infinite level", (c) => ({ ...c, level: Infinity })],
    ["unsafe level", (c) => ({ ...c, level: Number.MAX_SAFE_INTEGER + 1 })],
    ["zero attribute", (c) => ({ ...c, attributes: { ...c.attributes, str: 0 } })],
    ["fractional attribute", (c) => ({ ...c, attributes: { ...c.attributes, str: 1.5 } })],
    ["NaN attribute", (c) => ({ ...c, attributes: { ...c.attributes, str: NaN } })],
    [
      "unsafe attribute",
      (c) => ({ ...c, attributes: { ...c.attributes, str: Number.MAX_SAFE_INTEGER + 1 } }),
    ],
    ["missing attribute", (c) => ({ ...c, attributes: { str: 1 } })],
    ["extra attribute", (c) => ({ ...c, attributes: { ...c.attributes, luck: 1 } })],
    ["negative rebirth points", (c) => ({ ...c, rebirthPoints: -1 })],
    ["too many rebirth points", (c) => ({ ...c, rebirthPoints: 141 })],
    ["fractional rebirth points", (c) => ({ ...c, rebirthPoints: 10.5 })],
    ["rebirth levels not array", (c) => ({ ...c, rebirthLevels: {} })],
    ["sparse rebirth levels", (c) => ({ ...c, rebirthLevels: new Array(1) })],
    ["rebirth below range", (c) => ({ ...c, rebirthLevels: [99] })],
    ["rebirth above range", (c) => ({ ...c, rebirthLevels: [141] })],
    ["fractional rebirth level", (c) => ({ ...c, rebirthLevels: [100.5] })],
    ["too many rebirths", (c) => ({ ...c, rebirthLevels: [100, 100, 100, 100, 100] })],
    ["subsects not array", (c) => ({ ...c, subSects: null })],
    ["sparse subsects", (c) => ({ ...c, subSects: new Array(1) })],
    ["invalid subsect", (c) => ({ ...c, subSects: ["CLASS_BAD"] })],
    ["duplicate subsect", (c) => ({ ...c, subSects: ["CLASS_GOD", "CLASS_GOD"] })],
    ["too many subsects", (c) => ({ ...c, subSects: ["CLASS_GOD", "CLASS_ISLE", "CLASS_MAGIC"] })],
    ["equipment not record", (c) => ({ ...c, equipment: [] })],
    ["missing equipment slot", (c) => ({ ...c, equipment: { cap: null } })],
    ["unknown equipment slot", (c) => ({ ...c, equipment: { ...c.equipment, extra: null } })],
    [
      "invalid item id",
      (c) => ({
        ...c,
        equipment: { ...c.equipment, right: { itemId: 0, enhancementLevel: 0, manualBonuses: {} } },
      }),
    ],
    ...[-1, 31, 0.5, Infinity].map((level): [string, (c: CharacterV1) => unknown] => [
      `invalid enhancement ${level}`,
      (c) => ({
        ...c,
        equipment: {
          ...c.equipment,
          right: { itemId: 1, enhancementLevel: level, manualBonuses: {} },
        },
      }),
    ]),
    [
      "unknown equip bonus",
      (c) => ({
        ...c,
        equipment: {
          ...c.equipment,
          right: { itemId: 1, enhancementLevel: 0, manualBonuses: { luck: 1 } },
        },
      }),
    ],
    [
      "nonfinite equip bonus",
      (c) => ({
        ...c,
        equipment: {
          ...c.equipment,
          right: { itemId: 1, enhancementLevel: 0, manualBonuses: { atk: Infinity } },
        },
      }),
    ],
    ["passives not record", (c) => ({ ...c, passiveLevels: [] })],
    ["invalid passive id", (c) => ({ ...c, passiveLevels: { nope: 1 } })],
    ["negative passive", (c) => ({ ...c, passiveLevels: { 13: -1 } })],
    ["fractional passive", (c) => ({ ...c, passiveLevels: { 13: 1.5 } })],
    ["unsafe passive", (c) => ({ ...c, passiveLevels: { 13: Number.MAX_SAFE_INTEGER + 1 } })],
    ["invalid meridian plan", (c) => ({ ...c, meridianPlan: 3 })],
    ["missing manual", (c) => ({ ...c, manual: undefined })],
    ["missing formation", (c) => ({ ...c, manual: { hero: {} } })],
    ["unknown manual bonus", (c) => ({ ...c, manual: { hero: { luck: 1 }, formation: {} } })],
    ["string manual bonus", (c) => ({ ...c, manual: { hero: { atk: "1" }, formation: {} } })],
    ["NaN manual bonus", (c) => ({ ...c, manual: { hero: {}, formation: { hp: NaN } } })],
  ];

  it.each(invalidCases)("rejects %s without repairing it", (_label, invalid) => {
    expect(parseCharacter(invalid(createDefaultCharacter()))).toEqual({
      ok: false,
      reason: "corrupt",
    });
  });

  it("rejects future versions on both the store and a nested character", () => {
    expect(parseCharacter({ ...createDefaultCharacter(), version: 2 })).toEqual({
      ok: false,
      reason: "unknown-version",
    });
    expect(parseCharacterStore({ version: 2 })).toEqual({ ok: false, reason: "unknown-version" });
    const saved = store();
    expect(
      parseCharacterStore({ ...saved, characters: [{ ...saved.characters[0], version: 2 }] }),
    ).toEqual({ ok: false, reason: "unknown-version" });
  });

  it("accepts an explicitly empty store and multiple uniquely identified characters", () => {
    const empty: CharacterStore = { version: 1, activeCharacterId: null, characters: [] };
    expect(parseCharacterStore(empty)).toEqual({ ok: true, store: empty });
    const saved = store();
    saved.characters.push(createDefaultCharacter());
    expect(parseCharacterStore(saved)).toEqual({ ok: true, store: saved });
  });

  it("rejects invalid store shape, duplicate ids, and dangling active ids", () => {
    const saved = store();
    for (const raw of [
      null,
      [],
      {},
      { ...saved, version: "1" },
      { ...saved, characters: {} },
      { ...saved, characters: [null] },
      { ...saved, characters: [saved.characters[0], saved.characters[0]] },
      { ...saved, activeCharacterId: "missing" },
      { ...saved, activeCharacterId: null },
      { version: 1, activeCharacterId: "missing", characters: [] },
    ])
      expect(parseCharacterStore(raw)).toEqual({ ok: false, reason: "corrupt" });
  });
});
