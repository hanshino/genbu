import { describe, it, expect } from "vitest";
import { levelToGenPrefix, itemTypeToSlotPrefix } from "../awakening";

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
