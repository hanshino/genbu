import { describe, expect, it } from "vitest";
import { ATTACK_SPEED_TABLE, SECTS } from "@/configs/stat-sim";
import { MAGIC_CLAN_LABELS } from "@/lib/constants/magic-clan";
import {
  bareFromEquipped, collectionLevels, computePanel, costBandForNextCost, inferRebirthPoints,
  levelPoints, nextCost, pointCost, rebirthReward,
} from "@/lib/stat-sim";
import {
  ATTRIBUTE_KEYS, EQUIP_SLOTS,
  type Attributes, type CharacterV1, type EquippedItem, type GameData, type PanelBonus,
  type PanelResult, type PassiveDef, type SectId, type SimItem,
} from "@/lib/types/stat-sim";

const emptyData = (): GameData => ({ itemsById: {}, enhancementsByPath: {}, passives: [], meridianIds: [] });
function character(overrides: Partial<CharacterV1> = {}): CharacterV1 {
  return {
    version: 1, id: "test", name: "測試角色", sectId: 8, subSects: [], level: 1,
    rebirthPoints: 0, attributes: { str: 1, pow: 1, vit: 1, agi: 1, dex: 1, wis: 1 },
    equipment: Object.fromEntries(EQUIP_SLOTS.map((slot) => [slot, null])) as CharacterV1["equipment"],
    passiveLevels: {}, meridianPlan: null, manual: { hero: {}, formation: {} }, ...overrides,
  };
}
function item(id: number, typeName: string | null, stats: PanelBonus = {}): SimItem {
  return { id, name: `測試裝備 ${id}`, typeName, level: 1, slotHint: null, stats, strongPathId: null };
}
function passive(id: number, level: number, bonus: PanelBonus, overrides: Partial<PassiveDef> = {}): PassiveDef {
  return {
    id, name: `測試技能 ${id}`, group: "common", clan: null, maxLevel: level,
    learnLevels: Array.from({ length: level + 1 }, () => 0), iconUrl: null,
    cumulative: Array.from({ length: level + 1 }, (_, n) => n === level ? bonus : {}), ...overrides,
  };
}
function expectBreakdowns(panel: PanelResult) {
  for (const stat of [...Object.values(panel.attributes), ...Object.values(panel.stats)]) {
    if (stat.value !== null) {
      expect(stat.breakdown.reduce((sum, row) => sum + row.amount, 0)).toBe(stat.value);
    }
    expect(stat.estimated).toBe(stat.estimateReasons.length > 0);
  }
}

// SYNTHETIC：不是 DB 裝備 ID／單件數值。以兩件虛擬裝備重現 §7 的裝備合計，
// run_speed 獨立放坐騎；被動只填驗收等級總值，不假造中間級數。
function kylinFixture(): { c: CharacterV1; data: GameData } {
  const c = character({
    sectId: 8192, subSects: ["CLASS_GOD"], level: 198, rebirthPoints: 140,
    attributes: { str: 99, pow: 1, vit: 32, agi: 1, dex: 85, wis: 95 },
  });
  const data = emptyData();
  data.itemsById[1] = item(1, "HAMMER", {
    hp: 10003, mp: 5863, str: 55, pow: 10, vit: 34, agi: 3, dex: 12, wis: 11,
    atk: 859, matk: 40, def: 497, mdef: 479, hit: 167, dodge: 77,
    critical: 17, uncanny_dodge: 8, attack_speed: 1, weight: 4757,
  });
  data.itemsById[2] = item(2, "HORSE", { run_speed: 12 });
  c.equipment.right = { itemId: 1, enhancementLevel: 0, manualBonuses: {} };
  c.equipment.horse = { itemId: 2, enhancementLevel: 0, manualBonuses: {} };
  const collection: PanelBonus[] = [
    { hp: 250 }, { mp: 50 }, { atk: 40 }, { matk: 40 },
    { def: 5 }, { mdef: 5 }, { hit: 4 }, { dodge: 4 },
  ];
  data.passives = [
    ...collection.map((bonus, i) => passive(1151 + i, 1, bonus, { group: "collection" })),
    passive(180, 4, { hp: 12000 }),
    passive(750, 10, { atk: 120 }, { group: "sub", clan: "CLASS_GOD", weaponReq: ["HAMMER"] }),
    passive(756, 10, { matk: 150 }, { group: "sub", clan: "CLASS_GOD", weaponReq: ["HAMMER"] }),
    passive(821, 10, { atk: 70 }, { group: "main", clan: "CLASS_MONTO_KYLIN", weaponReq: ["HAMMER"] }),
    passive(827, 10, { matk: 70 }, { group: "main", clan: "CLASS_MONTO_KYLIN", weaponReq: ["HAMMER"] }),
  ];
  c.passiveLevels = Object.fromEntries(data.passives.map((p) => [p.id, p.maxLevel]));
  return { c, data };
}

describe("面板公式 §7", () => {
  it("麒麟 Lv198：精確數值、估計負重／攻速與來源加總", () => {
    const { c, data } = kylinFixture();
    const panel = computePanel(c, data);
    expect(ATTRIBUTE_KEYS.map((key) => panel.attributes[key].value)).toEqual([154, 11, 66, 4, 97, 106]);
    expect(Object.fromEntries(Object.entries(panel.stats).map(([key, stat]) => [key, stat.value]))).toEqual({
      hp: 46363, mp: 8582, atk: 2025, matk: 334, def: 700, mdef: 714,
      hit: 710, dodge: 341, critical: 36, uncanny_dodge: 19, run_speed: 17,
      weight_cap: 79657, attack_speed: 8,
    });
    expect(panel.stats.weight_cap.estimated).toBe(true);
    expect(panel.stats.attack_speed.estimated).toBe(true);
    expect(panel.stats.hp.estimated).toBe(false);
    expect(panel.stats.atk.breakdown).toContainEqual({ source: "collection", label: "測試技能 1153 Lv1", refId: 1153, amount: 40 });
    expect(panel.issues).toEqual([]);
    expectBreakdowns(panel);
  });

  it("體力兩段分別 floor，不可最後才 floor", () => {
    const c = character({ sectId: 8192, level: 198, rebirthPoints: 140 });
    c.attributes.vit = 66;
    const hp = computePanel(c, emptyData()).stats.hp;
    expect(hp.value).toBe(24110);
    expect(hp.breakdown.map((row) => row.amount)).toEqual([19910, 4200]);
    expect(Math.floor(19910.9 + 4200.9)).toBe(24111);
  });

  it.each<[SectId, number]>([[2, 10], [4, 9], [8, 11], [512, 9], [2048, 11], [4096, 10], [8192, 15]])(
    "門派 %i 護勁遵守個別取整位置", (sectId, expected) => {
      const c = character({ sectId });
      c.attributes.pow = 3; c.attributes.wis = 5;
      expect(computePanel(c, emptyData()).stats.mdef.value).toBe(expected);
      expect(MAGIC_CLAN_LABELS[SECTS[sectId].mainClan]).toBeTruthy();
    },
  );

  it("六圍 tier 超過 200 不封頂，重擊處理浮點捨去", () => {
    const c = character();
    c.attributes.str = 216; c.attributes.wis = 180;
    let tier = 0;
    for (let t = 216 - 5; t > 0; t -= 10) tier += t;
    const result = computePanel(c, emptyData());
    expect(result.stats.atk.value).toBe(Math.floor(3 * 216 + 0.4 * tier + 1e-9));
    expect(result.stats.critical.value).toBe(28);
    expectBreakdowns(result);
  });

  it("天外天護勁分段捨去，0.7×90 的浮點誤差不會少 1", () => {
    const c = character();
    expect(computePanel(c, emptyData()).stats.mdef.value).toBe(1);
    c.attributes.pow = 90;
    expect(computePanel(c, emptyData()).stats.mdef.value).toBe(64);
  });

  it.each<[SectId, number]>([[2, 209], [4, 250], [8, 291], [512, 262], [2048, 360], [4096, 336], [8192, 291]])(
    "門派 %i 真氣係數與常數項", (sectId, expected) => {
      const c = character({ sectId, level: 10 });
      c.attributes.pow = 7; c.attributes.wis = 12;
      expect(computePanel(c, emptyData()).stats.mp.value).toBe(expected);
    },
  );
});

describe("配點與轉生 §9", () => {
  const cases: { sectId: SectId; level: number; attributes: Attributes; expected: number[] }[] = [
    { sectId: 8, level: 31, attributes: { str: 20, pow: 1, vit: 1, agi: 1, dex: 12, wis: 20 }, expected: [72, 0, 71, 1] },
    { sectId: 4, level: 192, attributes: { str: 142, pow: 1, vit: 36, agi: 1, dex: 74, wis: 1 }, expected: [973, 140, 1104, 9] },
    { sectId: 8192, level: 198, attributes: { str: 99, pow: 1, vit: 32, agi: 1, dex: 85, wis: 95 }, expected: [1015, 140, 1155, 0] },
  ];
  it.each(cases)("Lv$level 配點及轉生反推", ({ sectId, level, attributes, expected }) => {
    const c = character({ sectId, level, attributes, rebirthPoints: expected[1] });
    const { points } = computePanel(c, emptyData());
    expect([points.levelPoints, points.rebirthPoints, points.totalCost, points.remaining]).toEqual(expected);
    expect(inferRebirthPoints({ level, attributes, remaining: expected[3] })).toEqual({
      total: expected[1], status: "ok", reasons: [], estimated: false,
    });
  });
  it.each([[10, 1], [11, 2], [25, 2], [26, 3], [130, 9], [131, 10], [145, 10], [146, 11]])(
    "目標 %i 的單點成本 %i", (value, cost) => {
      expect(pointCost(value)).toBe(cost);
      expect(nextCost(value - 1)).toBe(cost);
    },
  );
  it.each([[1, 6], [2, 8], [25, 54], [26, 57], [50, 129], [51, 133], [75, 229],
    [76, 234], [100, 354], [101, 360], [125, 504], [126, 511], [175, 854], [198, 1015]])(
    "等級 %i 累積點數 %i", (lv, expected) => expect(levelPoints(lv)).toBe(expected),
  );
  it("轉生獎勵照表，含尾段非等距數字", () => {
    expect([100, 101, 102, 137, 138, 139, 140].map(rebirthReward)).toEqual([10, 11, 11, 32, 33, 34, 35]);
    expect(() => rebirthReward(99)).toThrow(RangeError);
    expect(() => rebirthReward(141)).toThrow(RangeError);
  });
  it("成本區間是 bare+1 的反推，含第一階下界", () => {
    expect(costBandForNextCost(1)).toEqual({ min: 1, max: 9 });
    expect(costBandForNextCost(2)).toEqual({ min: 10, max: 24 });
    expect(costBandForNextCost(7)).toEqual({ min: 85, max: 99 });
    for (let v = 1; v <= 500; v++) {
      const { min, max } = costBandForNextCost(nextCost(v));
      expect(v).toBeGreaterThanOrEqual(min);
      expect(v).toBeLessThanOrEqual(max);
      const c = character(); c.attributes.str = v;
      let expected = 0;
      for (let n = 2; n <= v; n++) expected += pointCost(n);
      expect(computePanel(c, emptyData()).points.costs.str).toBe(expected);
    }
    expect(bareFromEquipped(154, 55)).toBe(99);
    expect(bareFromEquipped(4, 10)).toBe(-6);
  });
  it("推算不足、非法輸入及總和都不默默修正", () => {
    const attributes = character().attributes;
    expect(inferRebirthPoints({ level: 1, attributes }).status).toBe("incomplete");
    expect(inferRebirthPoints({ level: 1, attributes: { ...attributes, str: null }, remaining: 0 }).status).toBe("incomplete");
    for (const remaining of [-1, NaN, Infinity, 0.5]) {
      expect(inferRebirthPoints({ level: 1, attributes, remaining })).toMatchObject({ total: null, status: "check" });
    }
    for (const total of [-1, 1, 9, 141]) {
      expect(inferRebirthPoints({ level: 1, attributes, remaining: total + 6 })).toMatchObject({ total, status: "check" });
    }
    for (const total of [0, 10, 140]) {
      expect(inferRebirthPoints({ level: 140, attributes, remaining: total + levelPoints(140) }).status).toBe("ok");
    }
    for (const total of [0, 39, 40, 140, 141]) {
      expect(inferRebirthPoints({ level: 141, attributes, remaining: total + levelPoints(141) }).status).toBe(total >= 40 && total <= 140 ? "ok" : "check");
    }
  });
  it("146 起推算成本估計；145 的下一點已需提示", () => {
    for (const str of [145, 146]) {
      const c = character({ level: 200, rebirthPoints: 140 }); c.attributes.str = str;
      const result = computePanel(c, emptyData());
      const inference = inferRebirthPoints({ level: c.level, attributes: c.attributes, remaining: result.points.remaining });
      expect(inference.estimated).toBe(str >= 146);
      expect(inference.total).toBe(140);
      expect(result.issues.map((i) => i.code)).toContain(str === 145 ? "estimated-next-cost" : "estimated-point-cost");
    }
  });
  it("工具拒絕非法數值而不是傳播 NaN", () => {
    for (const value of [NaN, Infinity, -1, 0, 1.5]) {
      expect(() => pointCost(value)).toThrow(RangeError);
      expect(() => levelPoints(value)).toThrow(RangeError);
      expect(() => nextCost(value)).toThrow(RangeError);
      expect(() => costBandForNextCost(value)).toThrow(RangeError);
    }
    expect(() => bareFromEquipped(NaN, 1)).toThrow(RangeError);
  });
});

describe("加成、條件與資料完整性", () => {
  function rolledFixture() {
    const c = character(); const data = emptyData();
    data.itemsById[1] = {
      ...item(1, "HELMET", { str: 2 }), strongPathId: 5, socketCount: 2, socketCategory: 2,
      randomOptions: [{ attribute: "外功", stat: "str", ranges: [[1, 3], [8, 10]] }],
    };
    data.enhancementsByPath[5] = { maxLevel: 1, levels: [{}, { str: 3 }] };
    data.socketRecipes = {
      10: { id: 10, name: "測試魂珠", effects: [{ stat: "str", ranges: [[2, 4], [8, 10]] }] },
      11: { id: 11, name: "武器魂珠", effects: [{ stat: "str", ranges: [[2, 4]] }] },
    };
    data.socketRecipeIdsByCategory = { 1: [11], 2: [10] };
    c.equipment.cap = { itemId: 1, enhancementLevel: 1, manualBonuses: { str: 4 } };
    return { c, data, equipped: c.equipment.cap };
  }

  it("隨機／插槽六圍先進公式，保留固定→隨機→強化→插槽→舊手動順序與含裝扣除", () => {
    const { c, data, equipped } = rolledFixture();
    equipped.randomRolls = [{ attribute: "外功", value: 3 }];
    equipped.sockets = [null, { recipeId: 10, stat: "str", value: 4 }];
    const before = structuredClone({ c, data });
    const panel = computePanel(c, data);
    expect(panel.attributes.str.value).toBe(17);
    expect(panel.attributes.str.breakdown.map((r) => r.source)).toEqual([
      "attribute", "equipment", "equipRandom", "enhancement", "socket", "equipManual",
    ]);
    expect(panel.attributes.str.breakdown).toContainEqual({
      source: "socket", label: "測試裝備 1 第 2 槽 測試魂珠", amount: 4, refId: 10,
    });
    expect(panel.attributes.str.breakdown).toContainEqual({
      source: "equipRandom", label: "測試裝備 1 隨機素質", amount: 3, refId: 1,
    });
    const equivalent = character({ attributes: { ...c.attributes, str: 17 } });
    expect(panel.stats.atk.value).toBe(computePanel(equivalent, emptyData()).stats.atk.value);
    expect(bareFromEquipped(30, panel.attributes.str.value! - c.attributes.str)).toBe(14);
    expect(panel.points.totalCost).toBe(0);
    expect(panel.issues).toEqual([]);
    expect({ c, data }).toEqual(before);
    expectBreakdowns(panel);
  });

  it.each<[string, Partial<EquippedItem>, string]>([
    ...[0, 4, 11, 1.5, NaN, Infinity].map((value): [string, Partial<EquippedItem>, string] => [
      `隨機值 ${value}`, { randomRolls: [{ attribute: "外功", value }] }, "invalid-random-roll",
    ]),
    ["未知隨機屬性", { randomRolls: [{ attribute: "額外", value: 1 }] }, "invalid-random-roll"],
    ...[1, 5, 11, 2.5, NaN, Infinity].map((value): [string, Partial<EquippedItem>, string] => [
      `插槽值 ${value}`, { sockets: [{ recipeId: 10, stat: "str", value }] }, "invalid-socket-effect",
    ]),
    ["配方不存在", { sockets: [{ recipeId: 999, stat: "str", value: 2 }] }, "missing-socket-recipe"],
    ["配方錯誤類別", { sockets: [{ recipeId: 11, stat: "str", value: 2 }] }, "invalid-socket-category"],
    ["配方沒有此效果", { sockets: [{ recipeId: 10, stat: "hp", value: 2 }] }, "invalid-socket-effect"],
    ["超出固定槽數", { sockets: [null, null, { recipeId: 10, stat: "str", value: 2 }] }, "invalid-socket-index"],
    ["空槽也不能擴槽", { sockets: [null, null, null] }, "invalid-socket-index"],
  ])("%s 回報 error，不計入也不 clamp", (_label, invalid, code) => {
    const { c, data, equipped } = rolledFixture();
    const base = computePanel(c, data);
    Object.assign(equipped, invalid);
    const panel = computePanel(c, data);
    expect(panel.attributes.str.value).toBe(base.attributes.str.value);
    expect(panel.stats.atk.value).toBe(base.stats.atk.value);
    expect(panel.issues).toEqual([expect.objectContaining({ code, severity: "error" })]);
    expectBreakdowns(panel);
  });

  it("重複隨機素質只計第一次合法值；不同插槽可使用同配方", () => {
    const { c, data, equipped } = rolledFixture();
    equipped.randomRolls = [{ attribute: "外功", value: 1 }, { attribute: "外功", value: 3 }];
    equipped.sockets = [{ recipeId: 10, stat: "str", value: 2 }, { recipeId: 10, stat: "str", value: 8 }];
    const panel = computePanel(c, data);
    expect(panel.attributes.str.value).toBe(21);
    expect(panel.issues).toEqual([expect.objectContaining({ code: "invalid-random-roll", severity: "error" })]);
  });

  it("隨機條數超上限只警告且合法值全計入；不要求填足下限", () => {
    const { c, data, equipped } = rolledFixture();
    data.itemsById[1].randomOptions!.push({ attribute: "體力", stat: "hp", ranges: [[10, 20]] });
    equipped.randomRolls = [{ attribute: "外功", value: 3 }, { attribute: "體力", value: 20 }];
    const base = computePanel(c, data);
    data.itemsById[1].randomCount = [1, 1];
    const panel = computePanel(c, data);
    expect(panel.attributes).toEqual(base.attributes);
    expect(panel.stats).toEqual(base.stats);
    expect(panel.issues).toEqual([expect.objectContaining({ code: "excess-random-rolls", severity: "warning", refId: 1 })]);
    equipped.randomRolls.pop();
    expect(computePanel(c, data).issues).toEqual([]);
    equipped.randomRolls = [];
    expect(computePanel(c, data).issues).toEqual([]);
    delete equipped.randomRolls;
    expect(computePanel(c, data).issues).toEqual([]);
    data.itemsById[1].randomCount = [0, 0];
    equipped.randomRolls = [{ attribute: "外功", value: 3 }];
    expect(computePanel(c, data).issues[0].severity).toBe("warning");
    equipped.randomRolls = [{ attribute: "外功", value: 999 }];
    const invalid = computePanel(c, data);
    expect(invalid.attributes.str.value).toBe(10);
    expect(invalid.issues.map((i) => i.severity)).toEqual(["warning", "error"]);
  });

  it("惡人谷護勁對 P + 1.5W 整體取 floor", () => {
    expect(SECTS[2].mdef(3, 5)).toBe(10);
    expect(SECTS[2].mdef(3, 6)).toBe(12);
  });

  it("成就與其他被動六圍先進公式，累積值只算一次，英雄六圍仍最後加", () => {
    const c = character(); const data = emptyData();
    const bonus = { str: 9, pow: 10, vit: 11, agi: 24, dex: 24, wis: 19 };
    data.passives = [passive(1189, 2, bonus, { group: "achievement", obtainableMax: 0 }),
      passive(53, 1, { str: 2 }, { weaponReq: ["SWORD"] })];
    c.passiveLevels = { 1189: 2, 53: 1, 1150: 9 };
    c.manual.hero = { str: 100 };
    const p = computePanel(c, data);
    const equivalent = character({ attributes: { str: 10, pow: 11, vit: 12, agi: 25, dex: 25, wis: 20 } });
    expect(p.stats).toEqual(computePanel(equivalent, emptyData()).stats);
    expect(p.attributes.str.value).toBe(110);
    expect(p.attributes.str.breakdown).toContainEqual({ source: "passive", refId: 1189, label: "測試技能 1189 Lv2", amount: 9 });
    expect(p.points.totalCost).toBe(0);
    expect(p.issues.map((i) => i.code)).toEqual(["unobtainable-passive-level"]);
    expect(bareFromEquipped(p.attributes.str.value!, p.attributes.str.value! - c.attributes.str)).toBe(1);
    expectBreakdowns(p);
    data.itemsById[1] = item(1, "SWORD");
    c.equipment.right = { itemId: 1, enhancementLevel: 0, manualBonuses: {} };
    expect(computePanel(c, data).stats.atk.value).toBe(38); // floor(3×12 + .4×7)
  });

  it("收藏值套用門檻最高等級，降值清零九項且不依賴資料順序", () => {
    const thresholds = [
      { value: 450, magicId: 1151, level: 2 }, { value: 100, magicId: 1152, level: 1 },
      { value: 50, magicId: 1151, level: 1 }, { value: 500, magicId: 1159, level: 1 },
    ];
    const snapshot = structuredClone(thresholds);
    expect(Object.values(collectionLevels(49, thresholds))).toEqual(Array(9).fill(0));
    expect(collectionLevels(50, thresholds)[1151]).toBe(1);
    expect(collectionLevels(449, thresholds)[1151]).toBe(1);
    expect(collectionLevels(450, thresholds)).toMatchObject({ 1151: 2, 1152: 1, 1159: 0 });
    expect(collectionLevels(500, thresholds)[1159]).toBe(1);
    expect(collectionLevels(0, thresholds)[1159]).toBe(0);
    expect(thresholds).toEqual(snapshot);
    for (const n of [-1, 1.5, NaN, Infinity]) expect(() => collectionLevels(n, thresholds)).toThrow(RangeError);
  });
  it("強化取總值、不重複累加；裝備六圍進公式，英雄／陣法最後加", () => {
    const c = character(); const data = emptyData();
    data.itemsById[1] = { ...item(1, "STING", { str: 2, atk: 10 }), strongPathId: 5 };
    data.enhancementsByPath[5] = { maxLevel: 2, levels: [{}, { str: 1, atk: 5 }, { str: 3, atk: 8 }] };
    c.equipment.right = { itemId: 1, enhancementLevel: 2, manualBonuses: { str: 4, atk: 7 } };
    c.manual.hero = { str: 100, atk: 2 }; c.manual.formation = { str: 200, atk: 3 };
    const p = computePanel(c, data);
    expect(p.attributes.str.value).toBe(310);
    expect(p.stats.atk.value).toBe(32 + 10 + 8 + 7 + 2 + 3);
    expect(p.stats.atk.breakdown.map((row) => row.source)).toEqual(["equipment", "enhancement", "equipManual", "attribute", "hero", "formation"]);
    expectBreakdowns(p);
    c.manual.other = { hp: 1000, str: 1 };
    const other = computePanel(c, data);
    expect(other.stats.hp.value).toBe(p.stats.hp.value! + 1000);
    expect(other.attributes.str.value).toBe(311);
    expect(other.stats.atk.value).toBe(p.stats.atk.value);
    expect(other.stats.hp.breakdown.at(-1)).toMatchObject({ source: "manualOther", amount: 1000 });
    expectBreakdowns(other);
  });
  it("武器條件可由左手符合，weaponReqStats 只限制指定屬性", () => {
    const c = character(); const data = emptyData();
    data.passives = [passive(21, 2, { atk: 70 }, { weaponReq: ["SWORD"] }),
      passive(777, 2, { mp: 20, matk: 5 }, { weaponReq: ["STAFF"], weaponReqStats: ["matk"] })];
    c.passiveLevels = { 21: 2, 777: 2 };
    const off = computePanel(c, data);
    expect(off.stats.atk.value).toBe(3);
    expect(off.stats.matk.value).toBe(3);
    expect(off.stats.mp.value).toBe(85);
    data.itemsById[1] = item(1, "SWORD"); data.itemsById[2] = item(2, "STAFF");
    c.equipment.left = { itemId: 1, enhancementLevel: 0, manualBonuses: {} };
    expect(computePanel(c, data).stats.matk.estimated).toBe(true);
    c.equipment.right = { itemId: 2, enhancementLevel: 0, manualBonuses: {} };
    const on = computePanel(c, data);
    expect(on.stats.atk.value).toBe(73);
    expect(on.stats.matk.value).toBe(8);
    expect(on.stats.mp.value).toBe(85);
    expect(on.stats.matk.estimated).toBe(false);
    expectBreakdowns(on);
    // 資料層若暫列盾可生效，也必須標成未確認，不能誤當已驗證。
    c.equipment.left = null;
    data.itemsById[2] = item(2, "SHIELD");
    data.passives[1].weaponReq = ["STAFF", "SHIELD"];
    expect(computePanel(c, data).stats.matk).toMatchObject({ value: 8, estimated: true });
  });
  it("主副門派切換後保留等級，但不計入其他門派技能；低等轉生不抹掉已學技能", () => {
    const { c, data } = kylinFixture();
    c.subSects = []; c.sectId = 8;
    const p = computePanel(c, data);
    expect(p.stats.atk.value).toBe(936 + 859 + 40);
    expect(p.issues.filter((i) => i.code === "inactive-passive-clan")).toHaveLength(4);
    // 入門弟子技能轉職後必定不生效，不計入也不提示。
    data.passives.push(passive(4, 1, { atk: 50 }, { group: "main", clan: "CLASS_CHILD" }));
    c.passiveLevels[4] = 1;
    const child = computePanel(c, data);
    expect(child.stats.atk.value).toBe(936 + 859 + 40);
    expect(child.issues.filter((i) => i.code === "inactive-passive-clan")).toHaveLength(4);
    // 各級名稱不同時，breakdown 用目前等級的名稱。
    data.passives.push(passive(9, 2, { hp: 7 }, { name: "測試二重", levelNames: ["", "測試一重", "測試二重"] }));
    c.passiveLevels[9] = 2;
    expect(computePanel(c, data).stats.hp.breakdown.find((row) => row.refId === 9)?.label).toBe("測試二重 Lv2");
    data.passives.find((p) => p.id === 180)!.learnLevels[4] = 200;
    expect(p.stats.hp.breakdown.some((row) => row.refId === 180)).toBe(true);
    expect(computePanel(c, data).stats.hp.breakdown.some((row) => row.refId === 180)).toBe(true);
  });
  it("空手與天外匕首攻速精確；未知及較小表值估計，不杜撰雙劍表值", () => {
    const c = character(); c.attributes.agi = 50;
    const data = emptyData();
    expect(computePanel(c, data).stats.attack_speed).toMatchObject({ value: 9, estimated: false });
    c.equipment.right = { itemId: 1, enhancementLevel: 0, manualBonuses: {} };
    for (const type of ["STING", "HAMMER", "SWORD"]) {
      data.itemsById[1] = item(1, type, { attack_speed: 1 });
      expect(computePanel(c, data).stats.attack_speed).toMatchObject({ value: 10, estimated: type !== "STING" });
    }
    expect(ATTACK_SPEED_TABLE.HAMMER).toBeUndefined();
    data.itemsById[1] = item(1, "STING", { attack_speed: 1 }); c.sectId = 2;
    expect(computePanel(c, data).stats.attack_speed.estimated).toBe(true);
  });
  it.each(["BOW", "HIDDEN_WEAPON"])("%s 遠程物攻 null，不套近戰公式", (type) => {
    const c = character(); const data = emptyData();
    data.itemsById[1] = item(1, type);
    c.equipment.left = { itemId: 1, enhancementLevel: 0, manualBonuses: {} };
    const panel = computePanel(c, data);
    expect(panel.stats.atk).toMatchObject({ value: null, estimated: true, estimateReasons: ["v1 未支援遠程物攻"] });
    expectBreakdowns(panel);
  });
  it("盾不是攻速武器，移動只取坐騎／飾品，負重被動用 weight", () => {
    const c = character(); const data = emptyData();
    data.itemsById[1] = item(1, "SHIELD", { attack_speed: 99, run_speed: 99 });
    c.equipment.left = { itemId: 1, enhancementLevel: 0, manualBonuses: {} };
    data.itemsById[2] = item(2, "ORNAMENT", { run_speed: 2 });
    c.equipment.ornament3 = { itemId: 2, enhancementLevel: 0, manualBonuses: { run_speed: 1 } };
    data.passives = [passive(14, 1, { def: 9 }, { weaponReq: ["SHIELD"] }), passive(1159, 1, { weight: 100 }, { group: "collection" })];
    c.passiveLevels = { 14: 1, 1159: 1 };
    const p = computePanel(c, data);
    expect(p.stats.attack_speed).toMatchObject({ value: 7, estimated: false });
    expect(p.stats.run_speed.value).toBe(8);
    expect(p.stats.def.value).toBe(12);
    expect(p.stats.weight_cap.value).toBe(10450);
    expectBreakdowns(p);
  });
  it("缺資料、轉生違規與負剩餘點數皆回報；經脈不加入數值", () => {
    const c = character({ level: 141, rebirthPoints: 0, meridianPlan: "abc" });
    c.attributes.str = 200;
    c.equipment.cap = { itemId: 999, enhancementLevel: 0, manualBonuses: {} };
    c.equipment.right = { itemId: 1, enhancementLevel: 3, manualBonuses: {} };
    const data = emptyData(); data.itemsById[1] = { ...item(1, "STING"), strongPathId: 7 };
    const p = computePanel(c, data);
    expect(p.points.remaining).toBeLessThan(0);
    expect(p.issues.map((i) => i.code)).toEqual(expect.arrayContaining([
      "missing-item", "missing-enhancement-path", "overspent-points", "invalid-rebirth-points", "meridian-not-included",
    ]));
    expect(p.issues.find((i) => i.code === "meridian-not-included")?.message).toBe("經脈尚未計入");
    expect(p.stats.hp.estimated).toBe(true);
    expectBreakdowns(p);
    data.enhancementsByPath[7] = { maxLevel: 1, levels: [{}, {}] };
    expect(computePanel(c, data).issues.map((i) => i.code)).toContain("missing-enhancement-level");
  });
  it("損壞的強化／被動／非有限加值不造成 NaN", () => {
    const c = character(); const data = emptyData();
    data.itemsById[1] = item(1, "STING", { hp: NaN });
    c.equipment.right = { itemId: 1, enhancementLevel: -1, manualBonuses: {} };
    c.passiveLevels = { 999: 1, 53: 2 };
    data.passives = [passive(53, 1, { hp: 30 })];
    const p = computePanel(c, data);
    expect(p.issues.map((i) => i.code)).toEqual(expect.arrayContaining(["invalid-bonus", "invalid-enhancement-level", "missing-passive", "invalid-passive-level"]));
    expectBreakdowns(p);
  });
  it("computePanel 不改動任何輸入，輸出明細也不與輸入共享可變物件", () => {
    const { c, data } = kylinFixture();
    const before = structuredClone({ c, data });
    function freeze(value: unknown) {
      if (value && typeof value === "object") {
        Object.values(value).forEach(freeze); Object.freeze(value);
      }
    }
    freeze(c); freeze(data);
    const first = computePanel(c, data);
    expect(computePanel(c, data)).toEqual(first);
    first.stats.atk.breakdown[0].amount = -999;
    expect({ c, data }).toEqual(before);
    expect(computePanel(c, data).stats.atk.value).toBe(2025);
  });
});
