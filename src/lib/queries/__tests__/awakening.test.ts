import { describe, it, expect } from "vitest";
import { levelToGenPrefix, itemTypeToSlotPrefix, getAwakeningPath } from "../awakening";
import { getItemById } from "../items";

describe("levelToGenPrefix", () => {
  it("returns null for level 0 and below", () => {
    expect(levelToGenPrefix(0)).toBeNull();
    expect(levelToGenPrefix(-1)).toBeNull();
  });

  it("maps 1~39 to '20' (first generation has wider range)", () => {
    expect(levelToGenPrefix(1)).toBe("20");
    expect(levelToGenPrefix(7)).toBe("20");
    expect(levelToGenPrefix(20)).toBe("20");
    expect(levelToGenPrefix(39)).toBe("20");
  });

  it("maps 40~59 to '40'", () => {
    expect(levelToGenPrefix(40)).toBe("40");
    expect(levelToGenPrefix(59)).toBe("40");
  });

  it("maps 60~79 to '60'", () => {
    expect(levelToGenPrefix(60)).toBe("60");
    expect(levelToGenPrefix(79)).toBe("60");
  });

  it("maps 80~99 to '80'", () => {
    expect(levelToGenPrefix(80)).toBe("80");
    expect(levelToGenPrefix(99)).toBe("80");
  });

  it("maps 100~119 to '100'", () => {
    expect(levelToGenPrefix(100)).toBe("100");
    expect(levelToGenPrefix(119)).toBe("100");
  });

  it("maps 120~139 to '120'", () => {
    expect(levelToGenPrefix(120)).toBe("120");
    expect(levelToGenPrefix(139)).toBe("120");
  });

  it("maps 140~159 to '140'", () => {
    expect(levelToGenPrefix(140)).toBe("140");
    expect(levelToGenPrefix(159)).toBe("140");
  });

  it("maps 160~179 to '160'", () => {
    expect(levelToGenPrefix(160)).toBe("160");
    expect(levelToGenPrefix(179)).toBe("160");
  });

  it("maps 180~199 to '180'", () => {
    expect(levelToGenPrefix(180)).toBe("180");
    expect(levelToGenPrefix(199)).toBe("180");
  });

  it("maps 200+ to '200'", () => {
    expect(levelToGenPrefix(200)).toBe("200");
    expect(levelToGenPrefix(250)).toBe("200");
  });
});

describe("itemTypeToSlotPrefix", () => {
  it("passes through 防具 types unchanged", () => {
    expect(itemTypeToSlotPrefix("鞋")).toBe("鞋");
    expect(itemTypeToSlotPrefix("衣")).toBe("衣");
    expect(itemTypeToSlotPrefix("甲")).toBe("甲");
    expect(itemTypeToSlotPrefix("盾")).toBe("盾");
    expect(itemTypeToSlotPrefix("帽")).toBe("帽");
    expect(itemTypeToSlotPrefix("座騎")).toBe("座騎");
  });

  it("passes through 飾 types unchanged", () => {
    expect(itemTypeToSlotPrefix("中飾")).toBe("中飾");
    expect(itemTypeToSlotPrefix("左飾")).toBe("左飾");
    expect(itemTypeToSlotPrefix("右飾")).toBe("右飾");
    expect(itemTypeToSlotPrefix("背飾")).toBe("背飾");
  });

  it("collapses single-hand weapons into 單手武器", () => {
    for (const t of ["劍", "刀", "匕首", "扇", "拂塵", "拳刃", "雙劍", "暗器", "棍"]) {
      expect(itemTypeToSlotPrefix(t)).toBe("單手武器");
    }
  });

  it("maps 雙手刀 to 雙手武器", () => {
    expect(itemTypeToSlotPrefix("雙手刀")).toBe("雙手武器");
  });

  it("maps 法杖 to 法術武器", () => {
    expect(itemTypeToSlotPrefix("法杖")).toBe("法術武器");
  });

  it("returns null for non-equip types", () => {
    expect(itemTypeToSlotPrefix("藥品")).toBeNull();
    expect(itemTypeToSlotPrefix("寶箱")).toBeNull();
    expect(itemTypeToSlotPrefix("真元/魂石")).toBeNull();
    expect(itemTypeToSlotPrefix("未知1")).toBeNull();
  });

  it("returns null for 手套/手甲 (no formula prefix exists)", () => {
    expect(itemTypeToSlotPrefix("手套")).toBeNull();
    expect(itemTypeToSlotPrefix("手甲")).toBeNull();
  });

  it("returns null for 外裝 cosmetic types", () => {
    expect(itemTypeToSlotPrefix("鞋[外裝]")).toBeNull();
    expect(itemTypeToSlotPrefix("帽[外裝]")).toBeNull();
    expect(itemTypeToSlotPrefix("座騎[外裝]")).toBeNull();
  });

  it("returns null for null/empty type", () => {
    expect(itemTypeToSlotPrefix(null)).toBeNull();
    expect(itemTypeToSlotPrefix("")).toBeNull();
  });
});

describe("getAwakeningPath", () => {
  it("returns null for items whose type has no slot mapping (e.g. 藥品)", () => {
    const drug = getItemById(24003); // 活絡養生丹 type=藥品
    expect(drug).not.toBeNull();
    expect(getAwakeningPath(drug!)).toBeNull();
  });

  it("returns 20-stage path for level=7 鞋 mapping to 20鞋", () => {
    const item = getItemById(21108); // 究極黑布鞋 level=7 type=鞋
    expect(item).not.toBeNull();
    const path = getAwakeningPath(item!);
    expect(path).not.toBeNull();
    expect(path!.prefix).toBe("20鞋");
    expect(path!.stages).toHaveLength(20);
    expect(path!.stages[0].stage).toBe(1);
    expect(path!.stages[19].stage).toBe(20);
  });

  it("returns 20-stage path for level=116 鞋 mapping to 100鞋 with single DEF bonus", () => {
    const item = getItemById(21114); // 紅凜嬋妖鞋 level=116
    expect(item).not.toBeNull();
    const path = getAwakeningPath(item!);
    expect(path).not.toBeNull();
    expect(path!.prefix).toBe("100鞋");
    expect(path!.stages).toHaveLength(20);
    expect(path!.stages[0].bonuses).toHaveLength(1);
    expect(path!.stages[0].bonuses[0].bonusType).toBe("ITEM_BONUS_DEF");
    expect(path!.stages[0].bonuses[0].label).toBe("防禦");
  });

  it("filters out 跨階煉化 rows (containing '\"' in name)", () => {
    const item = getItemById(21114);
    const path = getAwakeningPath(item!);
    const stageNums = path!.stages.map((s) => s.stage);
    expect(stageNums).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    ]);
  });

  it("picks highest material_core_id when multi-path collision exists (100右飾)", () => {
    // 超品龍紋玉珮 level=100 type=右飾 → 100右飾，每階有 五星 vs 九星 雙路徑
    const item = getItemById(53450);
    expect(item).not.toBeNull();
    expect(item!.type).toBe("右飾");
    const path = getAwakeningPath(item!);
    expect(path).not.toBeNull();
    expect(path!.prefix).toBe("100右飾");
    const stage1 = path!.stages.find((s) => s.stage === 1)!;
    expect(stage1.bonuses).toHaveLength(1);
    expect(stage1.bonuses[0].bonusType).toBe("ITEM_BONUS_MDEF");
    // 取 material_core_id=26967 (九星) 的路徑：money=60000, value=2
    expect(stage1.materialId).toBe(26967);
    expect(stage1.materialName).toBe("九星覺醒符");
    expect(stage1.money).toBe(60_000);
    expect(stage1.bonuses[0].value).toBe(2);
  });

  it("populates material name from awakening token items (五星 for 100 系)", () => {
    const item = getItemById(21114);
    const path = getAwakeningPath(item!);
    const stage1 = path!.stages[0];
    expect(stage1.materialId).toBe(26932);
    expect(stage1.materialName).toBe("五星覺醒符");
    expect(stage1.materialAmount).toBeGreaterThanOrEqual(1);
  });

  it("uses 突破覺醒符 around +12 and 超越覺醒符 around +18", () => {
    const item = getItemById(21114);
    const path = getAwakeningPath(item!);
    const stage12 = path!.stages.find((s) => s.stage === 12);
    const stage18 = path!.stages.find((s) => s.stage === 18);
    expect(stage12?.materialName).toBe("突破覺醒符");
    expect(stage18?.materialName).toBe("超越覺醒符");
  });

  it("converts successProb from millionths to 0..1 range", () => {
    const item = getItemById(21114);
    const path = getAwakeningPath(item!);
    expect(path!.stages[0].successProb).toBeCloseTo(1, 5); // +1 是 100%
    const stage20 = path!.stages.find((s) => s.stage === 20);
    expect(stage20!.successProb).toBeGreaterThan(0);
    expect(stage20!.successProb).toBeLessThan(0.1); // +20 個位數百分比
  });
});
