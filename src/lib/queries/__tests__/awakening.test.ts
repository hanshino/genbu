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
  it("maps 防具 type_name to their 中文 slot label", () => {
    expect(itemTypeToSlotPrefix("BOOT")).toBe("鞋");
    expect(itemTypeToSlotPrefix("ARMOR")).toBe("衣");
    expect(itemTypeToSlotPrefix("SHIELD")).toBe("盾");
    expect(itemTypeToSlotPrefix("HELMET")).toBe("帽");
    expect(itemTypeToSlotPrefix("HORSE")).toBe("座騎");
  });

  it("maps WING (背飾) to its 中文 slot label", () => {
    expect(itemTypeToSlotPrefix("WING")).toBe("背飾");
  });

  it("returns null for ORNAMENT (左飾/中飾/右飾 sub-position no longer derivable from type_name)", () => {
    // items 表已將左飾/中飾/右飾併為單一 ORNAMENT type_code，原始子分類資訊遺失，
    // 故目前無法解析對應的覺醒前綴（已知限制，非本次 mapping 修復範圍）。
    expect(itemTypeToSlotPrefix("ORNAMENT")).toBeNull();
  });

  it("collapses single-hand weapons into 單手武器", () => {
    for (const t of [
      "SWORD",
      "BLADE",
      "STING",
      "CLAW",
      "WHISK",
      "BOXING",
      "HAMMER",
      "HIDDEN_WEAPON",
      "ROD",
    ]) {
      expect(itemTypeToSlotPrefix(t)).toBe("單手武器");
    }
  });

  it("maps GREAT_SWORD (雙手刀) to 雙手武器", () => {
    expect(itemTypeToSlotPrefix("GREAT_SWORD")).toBe("雙手武器");
  });

  it("maps STAFF (法杖) to 法術武器", () => {
    expect(itemTypeToSlotPrefix("STAFF")).toBe("法術武器");
  });

  it("returns null for non-equip types", () => {
    expect(itemTypeToSlotPrefix("POTION")).toBeNull();
    expect(itemTypeToSlotPrefix("SCARCE_ITEM")).toBeNull();
    expect(itemTypeToSlotPrefix("RETURN_SCROLL")).toBeNull();
    expect(itemTypeToSlotPrefix("BONUS")).toBeNull();
  });

  it("returns null for PUNCHER/BOW (手套/手甲，no formula prefix exists)", () => {
    expect(itemTypeToSlotPrefix("PUNCHER")).toBeNull();
    expect(itemTypeToSlotPrefix("BOW")).toBeNull();
  });

  it("returns null for unrecognized type_name values", () => {
    expect(itemTypeToSlotPrefix("NORMAL_ITEM")).toBeNull();
    expect(itemTypeToSlotPrefix("ITEM_PET")).toBeNull();
    expect(itemTypeToSlotPrefix("NOT_A_REAL_TYPE")).toBeNull();
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

  it("returns null for ORNAMENT items (100右飾 sub-position no longer resolvable)", () => {
    // 超品龍紋玉珮 level=100，原本 type=右飾 → 100右飾（每階有 五星 vs 九星 雙路徑）。
    // 遷移後 items.type_name 統一為 ORNAMENT，左飾/中飾/右飾 子分類資訊已遺失，
    // itemTypeToSlotPrefix 無法反查 "右飾"，故此類道具目前無覺醒路徑（已知限制）。
    const item = getItemById(53450);
    expect(item).not.toBeNull();
    expect(item!.type).toBe("ORNAMENT");
    const path = getAwakeningPath(item!);
    expect(path).toBeNull();
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
