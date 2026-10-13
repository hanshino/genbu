import { describe, it, expect } from "vitest";
import { getShops, getShopDetail, getShopsSellingItem } from "../shops";
import { getDb } from "../../db";
import { shopLabel } from "../../constants/shop";

describe("getShops", () => {
  it("回傳 89 家商店:武器店 12 家、道具店 77 家", () => {
    const shops = getShops();
    expect(shops).toHaveLength(89);
    expect(shops.filter((s) => s.kind === "weapon")).toHaveLength(12);
    expect(shops.filter((s) => s.kind === "item")).toHaveLength(77);
  });

  it("商店 9(SHOP.INI 首家武器店)賣 13 種", () => {
    const s = getShops().find((x) => x.id === 9)!;
    expect(s.kind).toBe("weapon");
    expect(s.sellCount).toBe(13);
  });

  it("附上計價幣別與最大宗商品類型,可組出辨識標籤", () => {
    const byId = new Map(getShops().map((s) => [s.id, s]));
    // 貨幣種類統計:金幣 48、貨幣道具 31、魅力值 1、其它 9
    const all = [...byId.values()];
    expect(all.filter((s) => s.currency.kind === "gold")).toHaveLength(48);
    expect(all.filter((s) => s.currency.kind === "item")).toHaveLength(31);
    expect(all.filter((s) => s.currency.kind === "charm")).toHaveLength(1);
    expect(all.filter((s) => s.currency.kind === "other")).toHaveLength(9);
    expect(byId.get(52)!.npcNames).toEqual(["謎霧兌換商人"]);
    expect(byId.get(54)!.npcNames).toEqual(["魅力兌換商人"]);
    expect(byId.get(54)!.location?.stageName).toBe("成都少城");
    expect(byId.get(52)!.location?.stageName).toBe("曼陀羅城");

    expect(shopLabel(byId.get(1)!)).toBe("飛雁山莊武器商");
    expect(byId.get(7)!.npcNames).toEqual(["莫愁谷道具店", "藥鋪掌櫃", "韓三娘"]);
    expect(shopLabel(byId.get(7)!)).toBe("莫愁谷道具店、藥鋪掌櫃、韓三娘");
    expect(shopLabel({ ...byId.get(1)!, npcNames: [] })).toBe("金幣武器店 · 衣");
  });

  it("位置僅在全部 NPC 名稱合計恰有一筆配置時顯示，不合併相同座標", () => {
    const placements = getDb().prepare(
      `SELECT p.stage_id AS stageId, p.stage_kind AS stageKind, s.name AS stageName,
              p.tile_x AS x, p.tile_y AS y
       FROM map_placements p
       LEFT JOIN stages s ON s.kind = p.stage_kind AND s.id = p.stage_id
       WHERE p.category = 'npc' AND p.npc_id IN (
         SELECT id FROM npc WHERE name IN (SELECT value FROM json_each(?))
       )`,
    );
    for (const shop of getShops()) {
      const rows = placements.all(JSON.stringify(shop.npcNames)) as Array<
        NonNullable<typeof shop.location>
      >;
      const expected = rows.length === 1 && rows[0].stageName && rows[0].x != null && rows[0].y != null
        ? rows[0] : null;
      // 52 謎霧兌換商人位置為手動指定（另測於上方）
      if (shop.id !== 52) expect(shop.location).toEqual(expected);
      expect(new Set(shop.npcNames).size).toBe(shop.npcNames.length);
      expect(getShopDetail(shop.id)!.npcNames).toEqual(shop.npcNames);
    }
  });
});

describe("getShopDetail", () => {
  it("商店 9(金幣店):青銅刀(20001)售價 = real_price 324、內部 rate 150", () => {
    const d = getShopDetail(9)!;
    expect(d.currency).toEqual({ kind: "gold", itemId: null, itemName: null });
    expect(d.sells).toHaveLength(13);
    const sword = d.sells.find((e) => e.itemId === 20001)!;
    expect(sword.itemName).toBe("青銅刀");
    // price 顯示的是 real_price(= floor(value 216 × rate 150 / 100)),不是 rate 本身
    expect(sword.price).toBe(324);
    expect(sword.rate).toBe(150);
  });

  it("兌換店(style0>100)：貨幣為貨幣道具,帶 item id 與名稱", () => {
    const d = getShopDetail(52)!;
    expect(d.currency).toEqual({ kind: "item", itemId: 31765, itemName: "謎霧之心" });
  });

  it("商店 69(style0=10 → other):幣別無法判定,售價直接為 real_price", () => {
    const d = getShopDetail(69)!;
    expect(d.currency).toEqual({ kind: "other", itemId: null, itemName: null });
    // 驗收:翅膀/坐騎的 real_price
    const priceOf = (id: number) => d.sells.find((e) => e.itemId === id)?.price;
    expect(priceOf(33954)).toBe(10); // 獎品兌換券
    expect(priceOf(33955)).toBe(10); // 成就外裝福袋
    expect(priceOf(50301)).toBe(20); // 必勝包中粽(翅膀)
    expect(priceOf(50322)).toBe(30); // 雲霓羅宇(翅膀)
    expect(priceOf(50506)).toBe(20); // 玄武太極龜(坐騎)
    expect(priceOf(50507)).toBe(40); // 劍走龍蛇(坐騎)
  });

  it("不存在的商店回傳 null", () => {
    expect(getShopDetail(99999)).toBeNull();
  });
});

describe("getShopsSellingItem", () => {
  it("青銅刀(20001)由 2 家販售,依 real_price 排序(280 → 324),皆金幣計價", () => {
    const rows = getShopsSellingItem(20001);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ shopId: 2, price: 280, rate: 130 });
    expect(rows[1]).toMatchObject({ shopId: 9, price: 324, rate: 150 });
    for (const r of rows) {
      expect(r.currency.kind).toBe("gold");
      expect(r.npcNames).toEqual(getShopDetail(r.shopId)!.npcNames);
    }
  });

  it("無人販售的道具回傳空陣列", () => {
    expect(getShopsSellingItem(999999)).toEqual([]);
  });
});
