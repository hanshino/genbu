import { describe, it, expect } from "vitest";
import {
  parseMaterialItems,
  parseModProb,
  getCompoundGroups,
  getCompoundGroupById,
  getCompoundById,
  getCompoundsByGroup,
  getCompoundsByType,
  getCompoundsByCoreMaterial,
  getCompoundUsesForItem,
  getCompoundSourcesForItem,
  getEquipmentEnhancementsForItemType,
  getEquipmentSlotForType,
  getCompoundsByGroupEnriched,
  getAllCompoundGroupsWithStats,
} from "../compound";

describe("parseMaterialItems", () => {
  it("parses canonical JSON", () => {
    expect(parseMaterialItems('[{"id":1,"amount":1},{"id":2,"amount":3}]')).toEqual([
      { id: 1, amount: 1 },
      { id: 2, amount: 3 },
    ]);
  });

  it("returns [] for empty / null / malformed", () => {
    expect(parseMaterialItems("[]")).toEqual([]);
    expect(parseMaterialItems(null)).toEqual([]);
    expect(parseMaterialItems("{not-json")).toEqual([]);
  });
});

describe("parseModProb", () => {
  it("parses canonical JSON", () => {
    const raw =
      '[{"type":"ITEM_BONUS_ATK","min":6,"max":6,"prob":150000},{"type":"0","min":0,"max":0,"prob":850000}]';
    expect(parseModProb(raw)).toEqual([
      { type: "ITEM_BONUS_ATK", min: 6, max: 6, prob: 150000 },
      { type: "0", min: 0, max: 0, prob: 850000 },
    ]);
  });

  it("returns [] for empty / null / malformed", () => {
    expect(parseModProb("[]")).toEqual([]);
    expect(parseModProb(null)).toEqual([]);
    expect(parseModProb("{not-json")).toEqual([]);
  });
});

describe("compound queries", () => {
  it("lists all 27 known compound_groups", () => {
    const groups = getCompoundGroups();
    expect(groups.length).toBe(27);
    expect(groups[0].id).toBe(2);
    expect(groups[0].name).toBe("魂石武器強化");
  });

  it("getCompoundGroupById returns known group / null for missing", () => {
    expect(getCompoundGroupById(70)?.name).toBe("武器強化");
    expect(getCompoundGroupById(999999)).toBeNull();
  });

  it("getCompoundById parses 波波鼠小真元強化 (id=10001)", () => {
    const c = getCompoundById(10001);
    expect(c).not.toBeNull();
    expect(c?.type).toBe("ITEM_COMPOUND_EQUIPMENT");
    expect(c?.name).toBe("波波鼠小真元強化");
    expect(c?.money).toBe(200);
    expect(c?.materialCoreId).toBe(25320);
    expect(c?.materialItems).toEqual([{ id: 1, amount: 1 }]);
    expect(c?.modProb.length).toBe(2);
    expect(c?.modProb[0].type).toBe("ITEM_BONUS_ATK");
    expect(c?.modProb[0].prob).toBe(150_000);
    // 全部 prob 加總應為 1,000,000（百萬分制）
    const sum = c!.modProb.reduce((s, e) => s + (e.prob ?? 0), 0);
    expect(sum).toBe(1_000_000);
    expect(c?.equipCrash).toBe(false);
  });

  it("getCompoundById returns null for unknown id", () => {
    expect(getCompoundById(999999)).toBeNull();
  });

  it("getCompoundsByGroup returns rows for group 70 (武器強化)", () => {
    const rows = getCompoundsByGroup(70);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r.group).toBe(70);
  });

  it("getCompoundsByType filters by type", () => {
    const equipment = getCompoundsByType("ITEM_COMPOUND_EQUIPMENT");
    expect(equipment.length).toBe(1026);
    for (const r of equipment) expect(r.type).toBe("ITEM_COMPOUND_EQUIPMENT");
  });

  it("getCompoundsByCoreMaterial returns recipes consuming the item", () => {
    // 25320 = 波波鼠小真元；至少同時是 10001（裝備）與 5001（飾品）的核心材料
    const rows = getCompoundsByCoreMaterial(25320);
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(10001);
    expect(ids).toContain(5001);
  });
});

describe("getCompoundUsesForItem", () => {
  it("returns enriched recipes with group name + side material names + outputs", () => {
    const uses = getCompoundUsesForItem(25320);
    expect(uses.length).toBeGreaterThanOrEqual(2);

    const eq = uses.find((u) => u.id === 10001);
    expect(eq).toBeDefined();
    expect(eq?.groupName).toBe("武器強化");
    expect(eq?.coreMaterial?.id).toBe(25320);
    expect(eq?.coreMaterial?.name).toBe("波波鼠小真元");
    expect(eq?.coreMaterial?.amount).toBe(1);
    expect(eq?.money).toBe(200);
    // 副材料：id=1 是裝備槽代碼（武器類），不是真實 item id
    expect(eq?.sideMaterials.length).toBe(1);
    expect(eq?.sideMaterials[0].id).toBe(1);
    expect(eq?.sideMaterials[0].name).toBe("武器類");
    // outputs 不含 type=0 padding，且按 prob desc 排序
    expect(eq?.outputs.length).toBe(1);
    expect(eq?.outputs[0].kind).toBe("bonus");
    expect(eq?.outputs[0].label).toBe("物攻");
    expect(eq?.outputs[0].prob).toBe(150_000);
    // failItem 應該被解析
    expect(eq?.failItem).not.toBeNull();
    expect(eq?.failItem?.id).toBe(24003);
  });

  it("resolves ITEM_BONUS_CREATEITEM target item id (min) to item name", () => {
    // 25320 = 波波鼠小真元；id=5001 (真元裝備還原) 的 mod_prob 是 CREATEITEM min/max=21911 (金色淚珠)
    const uses = getCompoundUsesForItem(25320);
    const ornament = uses.find((u) => u.id === 5001);
    expect(ornament).toBeDefined();
    expect(ornament?.outputs.length).toBe(1);
    const o = ornament!.outputs[0];
    expect(o.kind).toBe("item");
    expect(o.itemId).toBe(21911);
    expect(o.label).toBe("金色淚珠");
    // 數量為 1（不是 21911 — min/max 在 CREATEITEM 是 item id，已被改寫成 1）
    expect(o.min).toBe(1);
    expect(o.max).toBe(1);
  });

  it("translates side material item ids to names via items join", () => {
    // 33640 = 馬薺；id=20008 食譜的副料是 33641（鮮蝦）+ 33642
    const uses = getCompoundUsesForItem(33640);
    const recipe = uses.find((u) => u.id === 20008);
    expect(recipe).toBeDefined();
    expect(recipe?.sideMaterials.length).toBe(2);
    expect(recipe?.sideMaterials[0].name).toBe("鮮蝦");
    expect(recipe?.sideMaterials[0].amount).toBe(100);
  });

  it("translates numeric mod_prob.type into item names", () => {
    // 33640 = 馬薺 (核心材料)，產出 33643（type 為數字 id）
    const uses = getCompoundUsesForItem(33640);
    expect(uses.length).toBeGreaterThanOrEqual(1);
    const recipe = uses.find((u) => u.id === 20006);
    expect(recipe).toBeDefined();
    expect(recipe?.outputs.length).toBe(1);
    // label 是 items.name 而不是 "33643"
    expect(recipe?.outputs[0].itemId).toBe(33643);
    expect(recipe?.outputs[0].label).not.toMatch(/^#?\d+$/);
  });

  it("returns [] for items not used as core material", () => {
    expect(getCompoundUsesForItem(999999)).toEqual([]);
  });
});

describe("getCompoundSourcesForItem", () => {
  it("finds the recipe that produces 玄鐵劍 (numeric type output)", () => {
    // 20166 = 玄鐵劍；只由 21010 (天工記．兵部) 配方產出
    const sources = getCompoundSourcesForItem(20166);
    expect(sources.length).toBe(1);
    const recipe = sources[0];
    expect(recipe.id).toBe(21010);
    expect(recipe.groupName).toBe("天工記．兵部");
    expect(recipe.coreMaterial?.id).toBe(24552);
    expect(recipe.coreMaterial?.name).toBe("大符水");
    expect(recipe.coreMaterial?.amount).toBe(5);
    expect(recipe.sideMaterials.length).toBe(2);
    // 副材料：玄鐵礦石、大蜘蛛血（順序按 JSON 原序）
    const names = recipe.sideMaterials.map((s) => s.name).sort();
    expect(names).toContain("玄鐵礦石");
    expect(names).toContain("大蜘蛛血");
    // 該配方產出包含 20166
    expect(recipe.outputs.some((o) => o.itemId === 20166)).toBe(true);
  });

  it("finds CREATEITEM-source recipes (e.g. 金色淚珠 from 真元裝備還原)", () => {
    // 21911 = 金色淚珠；應該被多個 ITEM_BONUS_CREATEITEM min=21911 的配方產出
    const sources = getCompoundSourcesForItem(21911);
    expect(sources.length).toBeGreaterThan(0);
    // 至少 5001 (波波鼠小真元裝備) 應該在裡面
    expect(sources.some((s) => s.id === 5001)).toBe(true);
  });

  it("returns [] for items not produced by any recipe", () => {
    // 25320 = 波波鼠小真元 (材料系道具，不是任何配方的輸出)
    expect(getCompoundSourcesForItem(25320)).toEqual([]);
    expect(getCompoundSourcesForItem(999999)).toEqual([]);
  });
});

describe("getEquipmentSlotForType", () => {
  it("maps known equipment types to slot kinds", () => {
    expect(getEquipmentSlotForType("劍")).toBe(1);
    expect(getEquipmentSlotForType("帽")).toBe(2);
    expect(getEquipmentSlotForType("衣")).toBe(3);
    expect(getEquipmentSlotForType("盾")).toBe(3); // 盾屬 ARMOR slot
    expect(getEquipmentSlotForType("鞋")).toBe(4);
    expect(getEquipmentSlotForType("左飾")).toBe(5);
  });

  it("returns null for non-equipment / unknown types", () => {
    expect(getEquipmentSlotForType("座騎")).toBeNull();
    expect(getEquipmentSlotForType("背飾")).toBeNull();
    expect(getEquipmentSlotForType("藥品")).toBeNull();
    expect(getEquipmentSlotForType(null)).toBeNull();
  });
});

describe("getEquipmentEnhancementsForItemType", () => {
  it("returns weapon enhancements for type='劍' (group 70 + group 2)", () => {
    const uses = getEquipmentEnhancementsForItemType("劍");
    expect(uses.length).toBeGreaterThanOrEqual(238); // 182 (group 70) + 56 (group 2)
    // 應包含 10001 波波鼠小真元強化
    const sample = uses.find((u) => u.id === 10001);
    expect(sample).toBeDefined();
    expect(sample?.groupName).toBe("武器強化");
    expect(sample?.sideMaterials[0].name).toBe("武器類");
    // 全部都應該是 ITEM_COMPOUND_EQUIPMENT
    for (const u of uses) expect(u.type).toBe("ITEM_COMPOUND_EQUIPMENT");
  });

  it("returns armor enhancements for type='盾' (same as 衣)", () => {
    const shieldUses = getEquipmentEnhancementsForItemType("盾");
    const armorUses = getEquipmentEnhancementsForItemType("衣");
    expect(shieldUses.length).toBe(armorUses.length);
    expect(shieldUses.length).toBeGreaterThan(0);
    for (const u of shieldUses) expect(u.sideMaterials[0].name).toBe("衣服類");
  });

  it("returns [] for non-equipment types", () => {
    expect(getEquipmentEnhancementsForItemType("座騎")).toEqual([]);
    expect(getEquipmentEnhancementsForItemType("藥品")).toEqual([]);
    expect(getEquipmentEnhancementsForItemType(null)).toEqual([]);
  });

  it("uses i18n-aligned bonus labels (外功/內力/根骨/身法/玄學/真氣/重擊/拆招/護勁/木抗)", () => {
    // 抽樣若干 group 70 配方，確認 label 對齊 i18n.ts 而非通用 RPG 譯名
    const uses = getEquipmentEnhancementsForItemType("劍");
    const labels = new Set<string>();
    for (const u of uses) {
      const main = u.outputs[0];
      if (main?.kind === "bonus") labels.add(main.label);
    }
    // 不該出現舊的錯誤譯名
    expect(labels.has("力量")).toBe(false);
    expect(labels.has("敏捷")).toBe(false);
    expect(labels.has("體質")).toBe(false);
    expect(labels.has("悟性")).toBe(false);
    expect(labels.has("意志")).toBe(false);
    expect(labels.has("魔防")).toBe(false);
    expect(labels.has("暴擊")).toBe(false);
    expect(labels.has("土抗")).toBe(false);
  });
});

describe("getCompoundsByGroupEnriched", () => {
  it("returns enriched recipes for group 10 (天工記．兵部)", () => {
    const rows = getCompoundsByGroupEnriched(10);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r.groupName).toBe("天工記．兵部");
    // 21010 (玄鐵劍) 必須在內
    expect(rows.some((r) => r.id === 21010)).toBe(true);
  });

  it("returns [] for unknown groupId", () => {
    expect(getCompoundsByGroupEnriched(999999)).toEqual([]);
  });
});

describe("getAllCompoundGroupsWithStats", () => {
  it("lists all 27 groups with type breakdown + level range", () => {
    const stats = getAllCompoundGroupsWithStats();
    expect(stats.length).toBe(27);
    // group 70 = 武器強化 應該有 182 條 ITEM_COMPOUND_EQUIPMENT
    const g70 = stats.find((s) => s.id === 70);
    expect(g70?.name).toBe("武器強化");
    expect(g70?.typeBreakdown.ITEM_COMPOUND_EQUIPMENT).toBe(182);
    expect(g70?.count).toBe(182);
    expect(g70?.minLevel).toBeGreaterThan(0);
    expect(g70?.maxLevel).toBeGreaterThan(g70!.minLevel!);
  });
});
