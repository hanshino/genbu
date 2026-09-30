import { describe, it, expect } from "vitest";
import {
  DOLL_EQUIP_SLOTS,
  getDollRules,
  getDollHeads,
  getDollCatalog,
  getDollFrames,
  getItemDoll,
  getDefaultDollOutfit,
  type DollGender,
  type DollSlot,
} from "../doll";

// 真實 id（存在於 tthol.sqlite）
const BODY_ITEM_ID = 55376; // 鬼道陰陽衣：男 body 102872
const WING_ITEM_ID = 22082; // 熊貓背袱：男 104090、女 304090
const HEAD_SEQUENCE = 100001;
const ITEM_WITHOUT_PART = 23838; // 麋鹿女頭：has_part=0
const ITEM_WITHOUT_IMAGE = 20413; // 國王的新武器：有 part，沒有站立圖

describe("doll.ts", () => {
  it("讀取 48 條規則，方向 4 鏡像方向 2", () => {
    const rules = getDollRules();
    expect(rules).toHaveLength(48);
    expect(rules.filter((rule) => rule.dir === 4)).toHaveLength(6);
    for (const rule of rules.filter((rule) => rule.dir === 4)) {
      expect(rule.mirrorOf).toBe(2);
    }
    expect(rules.find((rule) => rule.slot === "head" && rule.dir === 1)).toEqual({
      slot: "head", dir: 1, mirrorOf: null, zOrder: expect.any(Number),
      offsetX: expect.any(Number), offsetY: expect.any(Number),
    });
  });

  it.each([ ["m", 11, 100001], ["f", 10, 300001] ] as const)(
    "%s 頭型按 sequence 排序且都有站立圖",
    (gender, count, first) => {
      const heads = getDollHeads(gender);
      expect(heads).toHaveLength(count);
      expect(heads[0]).toEqual({ sequence: first, label: "頭型 1" });
      expect(heads.map((head) => head.sequence)).toEqual(
        heads.map((head) => head.sequence).sort((a, b) => a - b),
      );
      heads.forEach((head, index) => {
        expect(head.label).toBe(`頭型 ${index + 1}`);
        expect(getDollFrames(gender, [{ slot: "head", sequence: head.sequence }]).length).toBeGreaterThan(0);
      });
    },
  );

  it("鬼道陰陽衣與熊貓背袱對應正確性別及部位", () => {
    expect(getItemDoll(BODY_ITEM_ID)).toEqual([
      { gender: "m", slot: "body", sequence: 102872, hasImage: true },
    ]);
    expect(getItemDoll(WING_ITEM_ID)).toEqual([
      { gender: "f", slot: "wing", sequence: 304090, hasImage: true },
      { gender: "m", slot: "wing", sequence: 104090, hasImage: true },
    ]);
  });

  it("缺 part 或缺圖的道具保留對應、hasImage 為 false", () => {
    for (const itemId of [ITEM_WITHOUT_PART, ITEM_WITHOUT_IMAGE]) {
      const parts = getItemDoll(itemId);
      expect(parts).toHaveLength(2);
      expect(parts.every((part) => part.hasImage === false)).toBe(true);
    }
    expect(getItemDoll(999999999)).toEqual([]);
  });

  it.each(["m", "f"] as const)("%s 目錄只含四個裝備部位、不重複道具", (gender) => {
    const catalog = getDollCatalog(gender);
    expect(Object.keys(catalog)).toEqual(DOLL_EQUIP_SLOTS);
    const ids = DOLL_EQUIP_SLOTS.flatMap((slot) => catalog[slot].map((item) => item.itemId));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain(ITEM_WITHOUT_PART);
    expect(catalog.wing).toContainEqual({
      itemId: WING_ITEM_ID, name: "熊貓背袱",
      sequence: gender === "m" ? 104090 : 304090, hasImage: true,
    });
    if (gender === "m") {
      expect(catalog.body).toContainEqual({
        itemId: BODY_ITEM_ID, name: "鬼道陰陽衣", sequence: 102872, hasImage: true,
      });
    } else {
      expect(ids).not.toContain(BODY_ITEM_ID);
    }
    for (const slot of DOLL_EQUIP_SLOTS) {
      for (const item of catalog[slot]) {
        expect(typeof item.hasImage).toBe("boolean");
        expect(item.hasImage).toBe(getDollFrames(gender, [{ slot, sequence: item.sequence }]).length > 0);
      }
    }
  });

  it("男頭型 100001 回傳五方向及圖像錨點", () => {
    const frames = getDollFrames("m", [{ slot: "head", sequence: HEAD_SEQUENCE }]);
    expect(frames.map((frame) => frame.dir)).toEqual([1, 2, 3, 7, 8]);
    for (const frame of frames) {
      expect(frame).toEqual({
        slot: "head", sequence: HEAD_SEQUENCE, dir: expect.any(Number),
        url: expect.any(String), width: expect.any(Number), height: expect.any(Number),
        anchorX: expect.any(Number), anchorY: expect.any(Number),
      });
      expect(frame.url.length).toBeGreaterThan(0);
      expect(frame.width).toBeGreaterThan(0);
      expect(frame.height).toBeGreaterThan(0);
    }
    expect(getDollFrames("f", [{ slot: "head", sequence: HEAD_SEQUENCE }])).toEqual([]);
  });

  it("多部位查詢按 slot 配對、去重且支援分塊", () => {
    const head = { slot: "head" as const, sequence: HEAD_SEQUENCE };
    const body = { slot: "body" as const, sequence: 102872 };
    const frames = getDollFrames("m", [head, body, head, { slot: "wing", sequence: HEAD_SEQUENCE }]);
    expect(frames).toHaveLength(10);
    expect(new Set(frames.map((frame) => frame.slot))).toEqual(new Set(["head", "body"]));
    const many = Array.from({ length: 950 }, (_, index) => ({
      slot: "head" as const, sequence: 900000000 + index,
    }));
    expect(getDollFrames("m", [...many, head, head])).toEqual(getDollFrames("m", [head]));
  });

  it.each([ ["m", 100001, 21045], ["f", 300001, 21047] ] as const)(
    "%s 預設頭型與預設衣褲有圖",
    (gender, head, body) => {
      expect(getDefaultDollOutfit(gender)).toEqual({ head, body, foot: 21131 });
      for (const itemId of [body, 21131]) {
        expect(getItemDoll(itemId).some((part) => part.gender === gender && part.hasImage)).toBe(true);
      }
    },
  );

  it("空輸入、不合法性別與部位安全回傳", () => {
    const invalidGender = "m' OR 1=1 --" as DollGender;
    expect(getDollHeads(invalidGender)).toEqual([]);
    expect(getDollCatalog(invalidGender)).toEqual({ cap: [], body: [], foot: [], wing: [] });
    expect(getDollFrames(invalidGender, [{ slot: "head", sequence: HEAD_SEQUENCE }])).toEqual([]);
    expect(getDefaultDollOutfit(invalidGender)).toEqual({ head: 0, body: null, foot: null });
    expect(getDollFrames("m", [])).toEqual([]);
    expect(getDollFrames("m", [
      { slot: "head' OR 1=1 --" as DollSlot, sequence: HEAD_SEQUENCE },
      { slot: "head", sequence: NaN },
      { slot: "head", sequence: -1 },
      { slot: "head", sequence: 1.5 },
    ])).toEqual([]);
    for (const id of [NaN, Infinity, -1, 0, 1.5]) expect(getItemDoll(id)).toEqual([]);
  });
});
