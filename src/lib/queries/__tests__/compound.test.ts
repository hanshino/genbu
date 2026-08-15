import { describe, it, expect } from "vitest";
import { isCompoundPlayerLevel } from "@/lib/constants/compound";
import { getDb } from "@/lib/db";
import { collectCompoundItemIds } from "@/lib/compound-grouping";
import { getItemIconMap } from "@/lib/queries/images";
import type { EquipmentSlotKind } from "@/lib/types/compound";
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
  ENHANCEMENT_BONUS_TYPES,
  bonusLabel,
  enhancementFamily,
  mergeBonus,
  getEnhancementsByBonus,
  sortEnhancements,
  parseEnhancementSearchParams,
  type EnhancementFamily,
  type EnhancementResult,
  type EnhancementSort,
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
    // 33648 = 絢麗彩紙；id=20008 食譜的副料是 33649（五色細繩）
    const uses = getCompoundUsesForItem(33648);
    const recipe = uses.find((u) => u.id === 20008);
    expect(recipe).toBeDefined();
    expect(recipe?.sideMaterials.length).toBe(1);
    expect(recipe?.sideMaterials[0].name).toBe("五色細繩");
    expect(recipe?.sideMaterials[0].amount).toBe(150);
  });

  it("translates numeric mod_prob.type into item names", () => {
    // 33648 = 絢麗彩紙（核心材料），產出 33652（type 為數字 id）
    const uses = getCompoundUsesForItem(33648);
    expect(uses.length).toBeGreaterThanOrEqual(1);
    const recipe = uses.find((u) => u.id === 20008);
    expect(recipe).toBeDefined();
    expect(recipe?.outputs.length).toBe(1);
    // label 是 items.name 而不是 "33643"
    expect(recipe?.outputs[0].itemId).toBe(33652);
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
  it("maps known equipment type_name to slot kinds", () => {
    expect(getEquipmentSlotForType("SWORD")).toBe(1);
    expect(getEquipmentSlotForType("HELMET")).toBe(2);
    expect(getEquipmentSlotForType("ARMOR")).toBe(3);
    expect(getEquipmentSlotForType("SHIELD")).toBe(3); // 盾屬 ARMOR slot
    expect(getEquipmentSlotForType("BOOT")).toBe(4);
    expect(getEquipmentSlotForType("ORNAMENT")).toBe(5);
  });

  it("returns null for non-equipment / unknown types", () => {
    expect(getEquipmentSlotForType("HORSE")).toBeNull();
    expect(getEquipmentSlotForType("WING")).toBeNull();
    expect(getEquipmentSlotForType("POTION")).toBeNull();
    expect(getEquipmentSlotForType(null)).toBeNull();
  });
});

describe("getEquipmentEnhancementsForItemType", () => {
  it("returns weapon enhancements for type='SWORD' (劍，group 70 + group 2)", () => {
    const uses = getEquipmentEnhancementsForItemType("SWORD");
    expect(uses.length).toBeGreaterThanOrEqual(238); // 182 (group 70) + 56 (group 2)
    // 應包含 10001 波波鼠小真元強化
    const sample = uses.find((u) => u.id === 10001);
    expect(sample).toBeDefined();
    expect(sample?.groupName).toBe("武器強化");
    expect(sample?.sideMaterials[0].name).toBe("武器類");
    // 全部都應該是 ITEM_COMPOUND_EQUIPMENT
    for (const u of uses) expect(u.type).toBe("ITEM_COMPOUND_EQUIPMENT");
  });

  it("returns armor enhancements for type='SHIELD' (盾，same as ARMOR/衣)", () => {
    const shieldUses = getEquipmentEnhancementsForItemType("SHIELD");
    const armorUses = getEquipmentEnhancementsForItemType("ARMOR");
    expect(shieldUses.length).toBe(armorUses.length);
    expect(shieldUses.length).toBeGreaterThan(0);
    for (const u of shieldUses) expect(u.sideMaterials[0].name).toBe("衣服類");
  });

  it("returns [] for non-equipment types", () => {
    expect(getEquipmentEnhancementsForItemType("HORSE")).toEqual([]);
    expect(getEquipmentEnhancementsForItemType("POTION")).toEqual([]);
    expect(getEquipmentEnhancementsForItemType(null)).toEqual([]);
  });

  it("uses i18n-aligned bonus labels (外功/內力/根骨/身法/玄學/真氣/重擊/拆招/護勁/木抗)", () => {
    // 抽樣若干 group 70 配方，確認 label 對齊 i18n.ts 而非通用 RPG 譯名
    const uses = getEquipmentEnhancementsForItemType("SWORD");
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
    expect(g70?.maxLevel).toBeLessThanOrEqual(200);
  });

  it("excludes encoded levels without dropping recipe counts", () => {
    const stats = getAllCompoundGroupsWithStats();
    const soulStoneGroups = stats.filter((s) => s.id >= 2 && s.id <= 6);
    expect(soulStoneGroups).toHaveLength(5);
    for (const group of soulStoneGroups) {
      expect(group.minLevel).toBeNull();
      expect(group.maxLevel).toBeNull();
    }
    expect(stats.find((s) => s.id === 2)?.count).toBe(56);
    expect(stats.every((group) => group.maxLevel == null || group.maxLevel <= 200)).toBe(true);
  });
});

describe("isCompoundPlayerLevel", () => {
  it.each([
    [200, true],
    [201, false],
    [1001, false],
    [0, false],
    [null, false],
    [undefined, false],
  ])("returns %s for level %s", (level, expected) => {
    expect(isCompoundPlayerLevel(level)).toBe(expected);
  });
});

// ─── 屬性導向強化查詢 ────────────────────────────────────────────────────────

/** 以 db.prepare 計數量測 query 數（沿用 monster-spawns.test.ts 的作法，不引入 mock framework）。 */
function countQueries(fn: () => void): number {
  const db = getDb();
  const original = db.prepare.bind(db);
  let count = 0;
  (db as unknown as { prepare: typeof original }).prepare = ((sql: string) => {
    count++;
    return original(sql);
  }) as typeof original;
  try {
    fn();
  } finally {
    (db as unknown as { prepare: typeof original }).prepare = original;
  }
  return count;
}

/** 掃描 20 種屬性，得到「配方 id → 該配方所有合併後屬性」的全庫視圖。 */
function scanAllMergedBonuses(): Map<number, EnhancementResult[]> {
  const byRecipe = new Map<number, EnhancementResult[]>();
  for (const bonusType of ENHANCEMENT_BONUS_TYPES) {
    for (const r of getEnhancementsByBonus({ bonusType, family: "all", slot: null })) {
      const list = byRecipe.get(r.use.id) ?? [];
      list.push(r);
      byRecipe.set(r.use.id, list);
    }
  }
  return byRecipe;
}

describe("enhancementFamily", () => {
  it("依名稱關鍵字四分類", () => {
    expect(enhancementFamily("赤魂石武器強化")).toBe("stone");
    expect(enhancementFamily("吉魂珠強化")).toBe("pearl");
    expect(enhancementFamily("波波鼠小真元強化")).toBe("yuan");
    expect(enhancementFamily("波波鼠強化裝備")).toBe("other");
    expect(enhancementFamily(null)).toBe("other");
  });

  it("判定順序 regression：義劭魂珠強化 是 pearl 不是 yuan", () => {
    // 魂石與魂珠都含「魂」，順序調換會誤判
    expect(enhancementFamily("義劭魂珠強化")).toBe("pearl");
    const use = getCompoundById(10761);
    expect(use?.name).toBe("義劭魂珠強化");
    expect(enhancementFamily(use!.name)).toBe("pearl");
  });

  it("四家族總數為 真元 502／魂石 240／其他 180／魂珠 104，合計 1,026", () => {
    const counts: Record<string, number> = { yuan: 0, pearl: 0, stone: 0, other: 0 };
    const all = getCompoundsByType("ITEM_COMPOUND_EQUIPMENT");
    for (const c of all) counts[enhancementFamily(c.name)]++;
    expect(counts).toEqual({ yuan: 502, pearl: 104, stone: 240, other: 180 });
    expect(counts.yuan + counts.pearl + counts.stone + counts.other).toBe(1026);
  });

  it("反向 regression：存在 group 落在 70–110 卻屬 pearl 的配方（禁止改回 group range 二分）", () => {
    const all = getCompoundsByType("ITEM_COMPOUND_EQUIPMENT");
    const pearlInYuanRange = all.filter(
      (c) => enhancementFamily(c.name) === "pearl" && c.group != null && c.group >= 70 && c.group <= 110,
    );
    expect(pearlInYuanRange.length).toBe(104);
    // 「其他」同樣混在 70–110，用 group 二分會一併誤標
    const otherInYuanRange = all.filter(
      (c) => enhancementFamily(c.name) === "other" && c.group != null && c.group >= 70 && c.group <= 110,
    );
    expect(otherInYuanRange.length).toBe(180);
  });
});

describe("mergeBonus", () => {
  it("合併同屬性多級距，取 min/max 極值與機率總和", () => {
    const merged = mergeBonus(
      [
        { rawType: "ITEM_BONUS_ATK", kind: "bonus", label: "物攻", itemId: null, min: 10, max: 15, prob: 250_000 },
        { rawType: "ITEM_BONUS_ATK", kind: "bonus", label: "物攻", itemId: null, min: 25, max: 30, prob: 100_000 },
        { rawType: "ITEM_BONUS_DEF", kind: "bonus", label: "防禦", itemId: null, min: 5, max: 5, prob: 50_000 },
      ],
      "ITEM_BONUS_ATK",
    );
    expect(merged).toEqual({
      rawType: "ITEM_BONUS_ATK",
      label: "物攻",
      min: 10,
      max: 30,
      prob: 350_000,
      segments: 2,
    });
  });

  it("無對應級距時回傳 null，且忽略零機率與非 bonus 條目", () => {
    expect(mergeBonus([], "ITEM_BONUS_ATK")).toBeNull();
    expect(
      mergeBonus(
        [
          { rawType: "ITEM_BONUS_ATK", kind: "bonus", label: "物攻", itemId: null, min: 1, max: 2, prob: 0 },
          { rawType: "ITEM_BONUS_ATK", kind: "raw", label: "x", itemId: null, min: 1, max: 2, prob: 100 },
        ],
        "ITEM_BONUS_ATK",
      ),
    ).toBeNull();
  });

  it("合併機率 clamp 於 1,000,000（資料異常時取上限，不 throw）", () => {
    const merged = mergeBonus(
      [
        { rawType: "ITEM_BONUS_ATK", kind: "bonus", label: "物攻", itemId: null, min: 1, max: 2, prob: 900_000 },
        { rawType: "ITEM_BONUS_ATK", kind: "bonus", label: "物攻", itemId: null, min: 2, max: 3, prob: 900_000 },
      ],
      "ITEM_BONUS_ATK",
    );
    expect(merged?.prob).toBe(1_000_000);
  });

  it("吉魂珠強化(10742) 的 ATK 合併為 min=10, max=30, prob=700000, segments=4", () => {
    const results = getEnhancementsByBonus({ bonusType: "ITEM_BONUS_ATK", family: "all", slot: null });
    const target = results.find((r) => r.use.id === 10742);
    expect(target).toBeDefined();
    expect(target!.use.name).toBe("吉魂珠強化");
    expect(target!.target).toEqual({
      rawType: "ITEM_BONUS_ATK",
      label: "物攻",
      min: 10,
      max: 30,
      prob: 700_000,
      segments: 4,
    });
  });

  it("反向 regression：10742 合併後 prob 嚴格大於任一單一級距機率（移除合併邏輯即失敗）", () => {
    const raw = getCompoundById(10742)!;
    const segs = raw.modProb.filter((p) => p.type === "ITEM_BONUS_ATK" && (p.prob ?? 0) > 0);
    expect(segs.length).toBe(4);
    const maxSingle = Math.max(...segs.map((s) => s.prob ?? 0));
    const results = getEnhancementsByBonus({ bonusType: "ITEM_BONUS_ATK", family: "all", slot: null });
    const merged = results.find((r) => r.use.id === 10742)!.target;
    expect(merged.prob).toBeGreaterThan(maxSingle);
    // 同樣不得只取 outputs[0]（機率最高的單段 = 250,000）
    expect(merged.prob).not.toBe(raw.modProb[0].prob);
    expect(merged.max).toBeGreaterThan(segs[0].max!);
  });

  it("全 1,026 筆掃描：任一屬性合併後 prob <= 1,000,000，0 筆例外", () => {
    const byRecipe = scanAllMergedBonuses();
    expect(byRecipe.size).toBe(1026);
    let over = 0;
    for (const list of byRecipe.values()) {
      for (const r of list) {
        expect(r.target.prob).toBeGreaterThan(0);
        if (r.target.prob > 1_000_000) over++;
      }
    }
    expect(over).toBe(0);
  });

  it("同屬性多級距配方 143 筆、多種不同屬性 3 筆", () => {
    const byRecipe = scanAllMergedBonuses();
    // 單一屬性但拆成多級距 → 必須合併才正確的 143 筆
    const singleAttrMultiSegment = [...byRecipe.values()].filter(
      (list) => list.length === 1 && list[0].target.segments > 1,
    );
    const multiAttribute = [...byRecipe.values()].filter((list) => list.length > 1);
    expect(singleAttrMultiSegment.length).toBe(143);
    expect(multiAttribute.length).toBe(3);
    // 那 3 筆是 愛珀/信珀/義珀魂珠強化（MDEF + DEF）
    const multiEntries = [...byRecipe.entries()].filter(([, l]) => l.length > 1);
    expect(multiEntries.map(([id]) => id).sort((a, b) => a - b)).toEqual([10795, 10796, 10797]);
    for (const [, list] of multiEntries) {
      expect(list.map((r) => r.target.rawType).sort()).toEqual([
        "ITEM_BONUS_DEF",
        "ITEM_BONUS_MDEF",
      ]);
    }
    // plan 的三分類是互斥的；實際「需要合併」的配方是 143 + 那 3 筆多屬性（其 MDEF 也是 5 段）= 146
    const needsMerge = [...byRecipe.values()].filter((list) =>
      list.some((r) => r.target.segments > 1),
    );
    expect(needsMerge.length).toBe(146);
    // 剩下的就是單一屬性單一級距 880 筆
    expect(byRecipe.size - needsMerge.length).toBe(880);
  });
});

describe("getEnhancementsByBonus", () => {
  it("ATK 為 60 筆（配方數，不是 94 條目數）", () => {
    const results = getEnhancementsByBonus({ bonusType: "ITEM_BONUS_ATK", family: "all", slot: null });
    expect(results).toHaveLength(60);
    expect(new Set(results.map((r) => r.use.id)).size).toBe(60);
  });

  it("DEF 為 91 筆（最大結果集）", () => {
    expect(
      getEnhancementsByBonus({ bonusType: "ITEM_BONUS_DEF", family: "all", slot: null }),
    ).toHaveLength(91);
  });

  it("每筆結果的 target.rawType 等於查詢屬性、prob > 0，且不含 type=\"0\"", () => {
    for (const bonusType of ENHANCEMENT_BONUS_TYPES) {
      for (const r of getEnhancementsByBonus({ bonusType, family: "all", slot: null })) {
        expect(r.target.rawType).toBe(bonusType);
        expect(r.target.prob).toBeGreaterThan(0);
        expect(r.use.outputs.some((o) => o.rawType === "0")).toBe(false);
        expect(r.use.type).toBe("ITEM_COMPOUND_EQUIPMENT");
      }
    }
  });

  it("ATK 家族分布：真元 37、魂珠 8、其他 15、魂石 0", () => {
    const results = getEnhancementsByBonus({ bonusType: "ITEM_BONUS_ATK", family: "all", slot: null });
    const counts: Record<string, number> = { yuan: 0, pearl: 0, stone: 0, other: 0 };
    for (const r of results) counts[r.family]++;
    expect(counts).toEqual({ yuan: 37, pearl: 8, stone: 0, other: 15 });
  });

  it("family filter 與 all 的分組結果一致", () => {
    const all = getEnhancementsByBonus({ bonusType: "ITEM_BONUS_DEF", family: "all", slot: null });
    for (const family of ["yuan", "pearl", "stone", "other"] as const) {
      const filtered = getEnhancementsByBonus({ bonusType: "ITEM_BONUS_DEF", family, slot: null });
      expect(filtered.map((r) => r.use.id)).toEqual(
        all.filter((r) => r.family === family).map((r) => r.use.id),
      );
      for (const r of filtered) expect(r.family).toBe(family);
    }
  });

  it("魂石缺口 regression：ATK/MATK/MDEF 的 stone 為 0，但 STR 的 stone > 0", () => {
    for (const bonusType of ["ITEM_BONUS_ATK", "ITEM_BONUS_MATK", "ITEM_BONUS_MDEF"]) {
      expect(getEnhancementsByBonus({ bonusType, family: "stone", slot: null })).toHaveLength(0);
    }
    // 確保不是 filter 壞掉導致全部為 0
    expect(
      getEnhancementsByBonus({ bonusType: "ITEM_BONUS_STR", family: "stone", slot: null }).length,
    ).toBeGreaterThan(0);
  });

  it("槽位過濾：ATK 只出現在武器與飾品", () => {
    const bySlot = ([1, 2, 3, 4, 5] as EquipmentSlotKind[]).map((slot) => ({
      slot,
      n: getEnhancementsByBonus({ bonusType: "ITEM_BONUS_ATK", family: "all", slot }).length,
    }));
    expect(bySlot.find((s) => s.slot === 2)!.n).toBe(0);
    expect(bySlot.find((s) => s.slot === 3)!.n).toBe(0);
    expect(bySlot.find((s) => s.slot === 4)!.n).toBe(0);
    expect(bySlot.find((s) => s.slot === 1)!.n).toBeGreaterThan(0);
    expect(bySlot.find((s) => s.slot === 5)!.n).toBeGreaterThan(0);
    expect(bySlot.reduce((s, x) => s + x.n, 0)).toBe(60);
  });

  it("槽位過濾的結果 sideMaterials[0].id 等於 requested slot", () => {
    for (const slot of [1, 5] as EquipmentSlotKind[]) {
      const results = getEnhancementsByBonus({ bonusType: "ITEM_BONUS_ATK", family: "all", slot });
      expect(results.length).toBeGreaterThan(0);
      for (const r of results) {
        expect(r.use.sideMaterials).toHaveLength(1);
        expect(r.use.sideMaterials[0].id).toBe(slot);
      }
    }
  });

  it("查無資料的屬性回傳 []", () => {
    expect(
      getEnhancementsByBonus({ bonusType: "ITEM_BONUS_CREATEITEM", family: "all", slot: null }),
    ).toEqual([]);
    expect(getEnhancementsByBonus({ bonusType: "NOT_A_BONUS", family: "all", slot: null })).toEqual([]);
  });
});

describe("期望消耗顆數", () => {
  it("prob=1,000,000 → 1 顆；prob=500,000 → 2 顆；prob=700,000 → 1.4 顆", () => {
    const byRecipe = scanAllMergedBonuses();
    const all = [...byRecipe.values()].flat();

    const full = all.filter((r) => r.target.prob === 1_000_000);
    expect(full.length).toBeGreaterThan(0);
    for (const r of full) expect(r.expectedMaterials).toBe(1);

    const half = all.filter((r) => r.target.prob === 500_000);
    expect(half.length).toBeGreaterThan(0);
    for (const r of half) expect(r.expectedMaterials).toBe(2);

    const target = all.find((r) => r.use.id === 10742 && r.target.rawType === "ITEM_BONUS_ATK")!;
    expect(target.target.prob).toBe(700_000);
    expect(Math.round(target.expectedMaterials! * 10) / 10).toBe(1.4);
  });

  it("讀 material_core_amount 而非寫死 1", () => {
    const target = getEnhancementsByBonus({
      bonusType: "ITEM_BONUS_ATK",
      family: "all",
      slot: null,
    }).find((r) => r.use.id === 10742)!;
    const amount = target.use.coreMaterial!.amount!;
    expect(amount).toBe(1);
    expect(target.expectedMaterials).toBeCloseTo(amount / (target.target.prob / 1_000_000), 10);
  });

  it("全 1,026 筆的期望顆數皆可計算，無任何一筆為 null", () => {
    const byRecipe = scanAllMergedBonuses();
    expect(byRecipe.size).toBe(1026);
    let nulls = 0;
    for (const r of [...byRecipe.values()].flat()) {
      if (r.expectedMaterials == null) nulls++;
      else {
        expect(Number.isFinite(r.expectedMaterials)).toBe(true);
        expect(r.expectedMaterials).toBeGreaterThanOrEqual(1);
      }
    }
    expect(nulls).toBe(0);
  });
});

describe("bonus type 清單與 label", () => {
  it("20 種 bonus type 全部有非空繁體中文 label", () => {
    expect(ENHANCEMENT_BONUS_TYPES).toHaveLength(20);
    expect(new Set(ENHANCEMENT_BONUS_TYPES).size).toBe(20);
    for (const t of ENHANCEMENT_BONUS_TYPES) {
      const label = bonusLabel(t);
      expect(label, t).toBeTruthy();
      expect(label).not.toMatch(/^ITEM_BONUS_/);
    }
  });

  it("抽驗既有譯名", () => {
    expect(bonusLabel("ITEM_BONUS_ATK")).toBe("物攻");
    expect(bonusLabel("ITEM_BONUS_MATK")).toBe("內勁");
    expect(bonusLabel("ITEM_BONUS_MDEF")).toBe("護勁");
    expect(bonusLabel("ITEM_BONUS_MP")).toBe("真氣");
    expect(bonusLabel("ITEM_BONUS_EARTH_DEF")).toBe("木抗");
    expect(bonusLabel("ITEM_BONUS_LIGHTNING_DEF")).toBe("雷抗");
    expect(bonusLabel("ITEM_BONUS_UNCANNYDODGE")).toBe("拆招");
    expect(bonusLabel("NOT_A_BONUS")).toBeUndefined();
  });

  it("每種 bonus type 都至少有一筆配方", () => {
    for (const bonusType of ENHANCEMENT_BONUS_TYPES) {
      expect(
        getEnhancementsByBonus({ bonusType, family: "all", slot: null }).length,
        bonusType,
      ).toBeGreaterThan(0);
    }
  });
});

describe("sortEnhancements", () => {
  const results = () =>
    getEnhancementsByBonus({ bonusType: "ITEM_BONUS_ATK", family: "all", slot: null });

  /** 獨立 oracle：只讀合併後的 target，不讀 outputs[0]。 */
  const oracle: Record<EnhancementSort, (a: EnhancementResult, b: EnhancementResult) => number> = {
    bonus: (a, b) =>
      b.target.max - a.target.max ||
      b.target.min - a.target.min ||
      b.target.prob - a.target.prob ||
      nullsLast(a.expectedMaterials, b.expectedMaterials) ||
      a.use.id - b.use.id,
    probability: (a, b) =>
      b.target.prob - a.target.prob ||
      b.target.max - a.target.max ||
      b.target.min - a.target.min ||
      nullsLast(a.expectedMaterials, b.expectedMaterials) ||
      a.use.id - b.use.id,
    materials: (a, b) =>
      nullsLast(a.expectedMaterials, b.expectedMaterials) ||
      b.target.prob - a.target.prob ||
      b.target.max - a.target.max ||
      b.target.min - a.target.min ||
      a.use.id - b.use.id,
  };
  function nullsLast(a: number | null, b: number | null): number {
    if (a === b) return 0;
    if (a == null) return 1;
    if (b == null) return -1;
    return a - b;
  }

  it.each(["bonus", "probability", "materials"] as EnhancementSort[])(
    "%s 與獨立 oracle comparator 一致",
    (sort) => {
      const base = results();
      expect(sortEnhancements(base, sort).map((r) => r.use.id)).toEqual(
        [...base].sort(oracle[sort]).map((r) => r.use.id),
      );
    },
  );

  it("預設 bonus 排序把最高加值排最前，且重複執行順序一致", () => {
    const sorted = sortEnhancements(results(), "bonus");
    expect(sorted[0].target.max).toBe(Math.max(...sorted.map((r) => r.target.max)));
    expect(sortEnhancements(results(), "bonus").map((r) => r.use.id)).toEqual(
      sorted.map((r) => r.use.id),
    );
  });

  it("materials 排序把 null 期望顆數置尾", () => {
    const base = results();
    const withNull: EnhancementResult[] = [
      ...base.slice(0, 3),
      { ...base[3], expectedMaterials: null },
    ];
    const sorted = sortEnhancements(withNull, "materials");
    expect(sorted[sorted.length - 1].expectedMaterials).toBeNull();
  });

  it("不修改輸入陣列", () => {
    const base = results();
    const before = base.map((r) => r.use.id);
    sortEnhancements(base, "materials");
    expect(base.map((r) => r.use.id)).toEqual(before);
  });
});

describe("parseEnhancementSearchParams", () => {
  it("缺值或空字串取預設", () => {
    for (const params of [{}, { attribute: "", family: "  ", slot: "", sort: "" }]) {
      const parsed = parseEnhancementSearchParams(params);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) return;
      expect(parsed.search).toEqual({ bonusType: "ITEM_BONUS_ATK", family: "all", slot: null });
      expect(parsed.sort).toBe("bonus");
    }
  });

  it("20 種合法屬性全部通過", () => {
    for (const attribute of ENHANCEMENT_BONUS_TYPES) {
      const parsed = parseEnhancementSearchParams({ attribute });
      expect(parsed.ok, attribute).toBe(true);
      if (parsed.ok) expect(parsed.search.bonusType).toBe(attribute);
    }
  });

  it("接受五種 family 與三種 sort", () => {
    for (const family of ["all", "yuan", "pearl", "stone", "other"] as EnhancementFamily[]) {
      const parsed = parseEnhancementSearchParams({ family });
      expect(parsed.ok && parsed.search.family).toBe(family);
    }
    for (const sort of ["bonus", "probability", "materials"] as EnhancementSort[]) {
      const parsed = parseEnhancementSearchParams({ sort });
      expect(parsed.ok && parsed.sort).toBe(sort);
    }
  });

  it("slot 只接受 all 與 1–5", () => {
    expect(parseEnhancementSearchParams({ slot: "all" })).toMatchObject({
      ok: true,
      search: { slot: null },
    });
    for (const slot of ["1", "2", "3", "4", "5"]) {
      const parsed = parseEnhancementSearchParams({ slot });
      expect(parsed.ok && parsed.search.slot).toBe(Number(slot));
    }
    for (const slot of ["0", "6", "01", "1.0", "1.5", "-1", " 1 ", "x", "weapon"]) {
      expect(parseEnhancementSearchParams({ slot }).ok, slot).toBe(false);
    }
  });

  it("未知 attribute / family / sort 一律失敗，錯誤訊息保留原始輸入", () => {
    const bad = parseEnhancementSearchParams({
      attribute: "item_bonus_atk",
      family: "Yuan",
      sort: "price",
    });
    expect(bad.ok).toBe(false);
    if (bad.ok) return;
    expect(bad.errors).toHaveLength(3);
    expect(bad.errors.join()).toContain("item_bonus_atk");
    expect(bad.errors.join()).toContain("Yuan");
    expect(bad.errors.join()).toContain("price");
  });

  it("不接受重複參數形成的 array", () => {
    expect(
      parseEnhancementSearchParams({ attribute: ["ITEM_BONUS_ATK", "ITEM_BONUS_DEF"] }).ok,
    ).toBe(false);
    expect(parseEnhancementSearchParams({ slot: ["1"] }).ok).toBe(false);
  });

  it("invalid 輸入不觸發任何 DB query", () => {
    const count = countQueries(() => {
      expect(parseEnhancementSearchParams({ attribute: "nope", slot: "6" }).ok).toBe(false);
    });
    expect(count).toBe(0);
  });
});

describe("強化查詢的 query 數量（N+1 guard）", () => {
  it("getEnhancementsByBonus(DEF/all/all) 為 1 個 query（上限 2）", () => {
    let n = 0;
    const count = countQueries(() => {
      n = getEnhancementsByBonus({ bonusType: "ITEM_BONUS_DEF", family: "all", slot: null }).length;
    });
    expect(n).toBe(91);
    expect(count).toBeLessThanOrEqual(2);
    expect(count).toBe(1);
  });

  it("零結果（ATK + 魂石）為 1 個 query", () => {
    let n = -1;
    const count = countQueries(() => {
      n = getEnhancementsByBonus({ bonusType: "ITEM_BONUS_ATK", family: "stone", slot: null }).length;
    });
    expect(n).toBe(0);
    expect(count).toBe(1);
  });

  it("模擬頁面資料流（query + icon batch）為 2 個 query，且不隨結果筆數成長", () => {
    const pageFlow = (bonusType: string) => {
      const results = getEnhancementsByBonus({ bonusType, family: "all", slot: null });
      const ids = collectCompoundItemIds(results.map((r) => r.use));
      getItemIconMap(ids);
      return results.length;
    };
    let small = 0;
    let large = 0;
    const smallCount = countQueries(() => {
      small = pageFlow("ITEM_BONUS_WATER_DEF");
    });
    const largeCount = countQueries(() => {
      large = pageFlow("ITEM_BONUS_DEF");
    });
    expect(small).toBe(10);
    expect(large).toBe(91);
    expect(smallCount).toBe(2);
    expect(largeCount).toBe(2);
  });
});

