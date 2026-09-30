import { describe, it, expect } from "vitest";
import {
  getDollSlots,
  getDollRules,
  getDollHeads,
  getDollLooks,
  getDollLookByItem,
  getDollFrames,
  getItemDoll,
  getDollDefaults,
  getDollBase,
  type DollGender,
  type DollSlot,
} from "../doll";
import { GET } from "@/app/api/doll/looks/route";
import { getDb } from "@/lib/db";
import type { DollLook, DollFrame } from "../doll";

// 真實 id（存在於 tthol.sqlite）
const BODY_ITEM_ID = 55376; // 鬼道陰陽衣：男 body 102872
const WING_ITEM_ID = 22082; // 熊貓背袱：男 104090、女 304090
const HEAD_SEQUENCE = 100001;
const ITEM_WITHOUT_PART = 23838; // 麋鹿女頭：has_part=0
const ITEM_WITHOUT_IMAGE = 20413; // 國王的新武器：有 part，沒有圖

describe("doll.ts", () => {
  it("讀取全部規則，方向 4 鏡像方向 2", () => {
    const rules = getDollRules();
    const slots = new Set(rules.map((rule) => rule.slot));
    expect(rules).toHaveLength(slots.size * 8);
    expect(rules.filter((rule) => rule.dir === 4)).toHaveLength(slots.size);
    for (const rule of rules.filter((rule) => rule.dir === 4)) {
      expect(rule.mirrorOf).toBe(2);
    }
    expect(rules.find((rule) => rule.slot === "head" && rule.dir === 1)).toEqual({
      slot: "head", dir: 1, mirrorOf: null, zOrder: expect.any(Number),
      offsetX: expect.any(Number), offsetY: expect.any(Number),
    });
  });

  it.each([ ["m", 11, 100001, 29001], ["f", 10, 300001, 29051] ] as const)(
    "%s 頭型按 base 道具 id 排序且都有圖",
    (gender, count, first, itemId) => {
      const heads = getDollHeads(gender);
      expect(heads).toHaveLength(count);
      expect(heads[0]).toEqual({ sequence: first, label: "頭型 1", itemId });
      expect(heads.map((head) => head.itemId)).toEqual(
        heads.map((head) => head.itemId).sort((a, b) => a - b),
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

  it("裝備部位從 DB 按順序讀取", () => {
    const slots = getDollSlots();
    expect(slots.map((info) => info.sortOrder)).toEqual(
      slots.map((info) => info.sortOrder).sort((a, b) => a - b),
    );
    expect(slots.some((info) => info.slot === "head")).toBe(false);
    expect(slots).toHaveLength(9);
    expect(slots.find((info) => info.slot === "horse")?.replaces).toBe("foot");
  });

  it("新 schema 武器 pair 一起畫，offhand 獨立提供", () => {
    const pair = getDollLookByItem("m", 20086); // 幻龍手套
    expect(pair?.layers).toEqual([
      { slot: "right", sequence: 211018 }, { slot: "left", sequence: 261018 },
    ]);
    expect(pair?.offhandLayers).toBeNull();
    const blade = getDollLookByItem("m", 20001); // 青銅刀
    expect(blade?.layers).toEqual([{ slot: "right", sequence: 201001 }]);
    expect(blade?.offhandLayers).toEqual([{ slot: "left", sequence: 251001 }]);
    const pairBlade = getDollLookByItem("m", 20267); // 勾牙刃
    expect(pairBlade?.layers).toEqual([
      { slot: "right", sequence: 212002 }, { slot: "left", sequence: 262002 },
    ]);
    expect(pairBlade?.offhandLayers).toBeNull();
    expect(pairBlade?.hasImage).toBe(true);
  });

  it("長劍只有 prepare 圖，仍可試穿", () => {
    const look = getDollLookByItem("m", 20101);
    expect(look?.hasImage).toBe(true);
    expect(look?.layers).toEqual([{ slot: "right", sequence: 200001 }]);
    const frames = getDollFrames("m", [...look!.layers, ...look!.offhandLayers!]);
    expect(frames).toHaveLength(10);
    expect(new Set(frames.map((frame) => frame.action))).toEqual(new Set(["prepare"]));
    expect(getItemDoll(20101).every((part) => part.hasImage)).toBe(true);
  });

  it("base 與 sit 不出現在外觀目錄或道具外觀解析", () => {
    for (const gender of ["m", "f"] as const) {
      for (const { slot } of getDollSlots()) {
        const ids = getDollLooks(gender, slot).flatMap((look) => look.items.map((item) => item.itemId));
        expect(ids).not.toContain(20900); // 擺攤布：sit
        expect(ids).not.toContain(29101); // 初心者身-男：base
      }
      for (const itemId of [20900, 29101, 29151, 29001, 29051]) {
        expect(getDollLookByItem(gender, itemId)).toBeNull();
      }
    }
  });

  it("排除 base 後男衣服有 102 種外觀，包含鬼道陰陽衣", () => {
    const looks = getDollLooks("m", "body");
    expect(looks).toHaveLength(102);
    const look = looks.find((look) => look.items.some((item) => item.itemId === BODY_ITEM_ID));
    expect(look).toMatchObject({
      key: "body:102872", slot: "body", layers: [{ slot: "body", sequence: 102872 }],
      offhandLayers: null, hasImage: true,
    });
    expect(look?.items).toContainEqual({ itemId: BODY_ITEM_ID, name: "鬼道陰陽衣", isExtra: true });
  });

  it("藍錦布甲與精工藍錦布甲共享同一個女外觀", () => {
    const look = getDollLookByItem("f", 21047);
    expect(look?.layers).toEqual([{ slot: "body", sequence: 302017 }]);
    expect(look?.items.map((item) => item.itemId)).toEqual(expect.arrayContaining([21047, 21057]));
    expect(getDollLookByItem("f", 21057)).toEqual(look);
    expect(getDollLookByItem("m", WING_ITEM_ID)?.slot).toBe("wing");
    expect(getDollLookByItem("f", BODY_ITEM_ID)).toBeNull();
    expect(getDollLookByItem("m", ITEM_WITHOUT_PART)).toBeNull();
    expect(getDollLookByItem("m", 999999999)).toBeNull();
  });

  it.each(["m", "f"] as const)("%s 外觀分組、圖片、外裝與排序正確", (gender) => {
    for (const { slot } of getDollSlots()) {
      const looks = getDollLooks(gender, slot);
      const ids = looks.flatMap((look) => look.items.map((item) => item.itemId));
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids).not.toContain(ITEM_WITHOUT_PART);
      expect(new Set(looks.map((look) => look.key)).size).toBe(looks.length);
      for (const [index, look] of looks.entries()) {
        expect(look.slot).toBe(slot);
        expect(look.items.map((item) => item.itemId)).toEqual(
          look.items.map((item) => item.itemId).sort((a, b) => a - b),
        );
        const frames = getDollFrames(gender, look.layers);
        expect(look.hasImage).toBe(look.layers.every((part) => frames.some((frame) =>
          frame.slot === part.slot && frame.sequence === part.sequence,
        )));
        let firstIcon: string | null = null;
        for (const item of look.items) {
          const equip = getDb().prepare(
            "SELECT equip_slot FROM item_doll WHERE item_id = ? AND gender = ? AND role = 'main'",
          ).get(item.itemId, gender) as { equip_slot: string | null };
          expect(item.isExtra).toBe(equip.equip_slot?.startsWith("EXTRA_") ?? false);
          const icon = getDb().prepare("SELECT url FROM item_images WHERE item_id = ? AND kind = 'icon'")
            .get(item.itemId) as { url: string } | undefined;
          firstIcon ??= icon?.url ?? null;
        }
        expect(look.icon).toBe(firstIcon);
        if (index > 0) {
          const previous = looks[index - 1];
          expect(Number(previous.hasImage)).toBeGreaterThanOrEqual(Number(look.hasImage));
          if (previous.hasImage === look.hasImage) {
            expect(previous.items.length).toBeGreaterThanOrEqual(look.items.length);
          }
        }
      }
    }
  });

  it("男頭型 100001 回傳兩個 action 各五方向及圖像錨點", () => {
    const frames = getDollFrames("m", [{ slot: "head", sequence: HEAD_SEQUENCE }]);
    expect(frames).toHaveLength(10);
    for (const action of ["wait", "prepare"] as const) {
      expect(frames.filter((frame) => frame.action === action).map((frame) => frame.dir))
        .toEqual([1, 2, 3, 7, 8]);
    }
    for (const frame of frames) {
      expect(frame).toEqual({
        slot: "head", sequence: HEAD_SEQUENCE, dir: expect.any(Number),
        action: expect.stringMatching(/^(wait|prepare)$/),
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
    expect(frames).toHaveLength(20);
    expect(new Set(frames.map((frame) => frame.slot))).toEqual(new Set(["head", "body"]));
    const many = Array.from({ length: 950 }, (_, index) => ({
      slot: "head" as const, sequence: 900000000 + index,
    }));
    expect(getDollFrames("m", [...many, head, head])).toEqual(getDollFrames("m", [head]));
  });

  it.each([ ["m", 100001, 102001, 103001], ["f", 300001, 302001, 303001] ] as const)(
    "%s 預設不穿道具，空欄位有初心者底裝",
    (gender, head, body, foot) => {
      expect(getDollDefaults(gender)).toEqual({ head, items: {} });
      const base = getDollBase(gender);
      expect(base).toEqual({
        body: { slot: "body", sequence: body }, foot: { slot: "foot", sequence: foot },
      });
      const frames = getDollFrames(gender, Object.values(base));
      for (const slot of ["body", "foot"] as const) {
        for (const action of ["wait", "prepare"] as const) {
          expect(frames.filter((frame) => frame.slot === slot && frame.action === action))
            .toHaveLength(5);
        }
      }
    },
  );

  it("缺 prepare 的褲子仍回傳 wait 圖供 UI fallback", () => {
    const frames = getDollFrames("m", [{ slot: "foot", sequence: 103225 }]);
    expect(frames).toHaveLength(5);
    expect(frames.every((frame) => frame.action === "wait")).toBe(true);
  });

  it("空輸入、不合法性別與部位安全回傳", () => {
    const invalidGender = "m' OR 1=1 --" as DollGender;
    expect(getDollHeads(invalidGender)).toEqual([]);
    expect(getDollLooks(invalidGender, "body")).toEqual([]);
    expect(getDollLooks("m", "body' OR 1=1 --" as DollSlot)).toEqual([]);
    expect(getDollLooks("m", "head")).toEqual([]);
    expect(getDollLookByItem(invalidGender, BODY_ITEM_ID)).toBeNull();
    expect(getDollFrames(invalidGender, [{ slot: "head", sequence: HEAD_SEQUENCE }])).toEqual([]);
    expect(getDollDefaults(invalidGender)).toEqual({ head: 0, items: {} });
    expect(getDollBase(invalidGender)).toEqual({});
    expect(getDollFrames("m", [])).toEqual([]);
    expect(getDollFrames("m", [
      { slot: "head' OR 1=1 --" as DollSlot, sequence: HEAD_SEQUENCE },
      { slot: "head", sequence: NaN },
      { slot: "head", sequence: -1 },
      { slot: "head", sequence: 1.5 },
    ])).toEqual([]);
    for (const id of [NaN, Infinity, -1, 0, 1.5]) {
      expect(getItemDoll(id)).toEqual([]);
      expect(getDollLookByItem("m", id)).toBeNull();
    }
  });
});

describe("GET /api/doll/looks", () => {
  it.each(["g=m&slot=bad", "g=x&slot=cap", "g=m&slot=head", "slot=cap", "g=m"])(
    "不合法參數 %s 回傳 400",
    async (query) => {
      const response = GET(new Request(`http://localhost/api/doll/looks?${query}`));
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: expect.any(String) });
      expect(response.headers.get("Cache-Control")).toBeNull();
    },
  );

  it("回傳全部外觀及去重圖層，允許快取", async () => {
    const response = GET(new Request("http://localhost/api/doll/looks?g=m&slot=cap"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("s-maxage=86400");
    const data = await response.json() as { looks: DollLook[]; frames: DollFrame[] };
    expect(data.looks).toEqual(getDollLooks("m", "cap"));
    expect(data.frames.length).toBeGreaterThan(0);
    expect(new Set(data.frames.map((frame) => frame.action))).toEqual(new Set(["wait", "prepare"]));
    expect(data.frames).toEqual(getDollFrames("m", data.looks.flatMap((look) => [
      ...look.layers, ...(look.offhandLayers ?? []),
    ])));
    expect(new Set(data.frames.map((frame) => `${frame.slot}:${frame.sequence}:${frame.action}:${frame.dir}`)).size)
      .toBe(data.frames.length);
  });

  it("量測男武器完整 JSON 回應大小", async () => {
    const response = GET(new Request("http://localhost/api/doll/looks?g=m&slot=right"));
    expect(response.status).toBe(200);
    const json = await response.text();
    const data = JSON.parse(json) as { looks: DollLook[]; frames: DollFrame[] };
    console.info(`m/right: ${data.looks.length} looks, ${data.frames.length} frames, ${Buffer.byteLength(json, "utf8")} bytes (JSON, uncompressed)`);
    expect(data.looks.length).toBeGreaterThan(0);
    expect(data.frames.length).toBeGreaterThan(0);
    expect(data.frames.every((frame) => frame.action === "prepare")).toBe(true);
  });
});
