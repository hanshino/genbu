import { describe, it, expect } from "vitest";
import { getShops, getShopDetail, getShopsSellingItem, getShopsBuyingItem } from "../shops";

describe("getShops", () => {
  it("回傳 89 家商店:武器店 12 家、道具店 77 家", () => {
    const shops = getShops();
    expect(shops).toHaveLength(89);
    expect(shops.filter((s) => s.kind === "weapon")).toHaveLength(12);
    expect(shops.filter((s) => s.kind === "item")).toHaveLength(77);
  });

  it("商店 9(SHOP.INI 首家武器店)賣 13 種、收 1 種", () => {
    const s = getShops().find((x) => x.id === 9)!;
    expect(s.kind).toBe("weapon");
    expect(s.sellCount).toBe(13);
    expect(s.buyCount).toBe(1);
  });
});

describe("getShopDetail", () => {
  it("商店 9:販售含青銅刀(20001)150 銀,收購青銅刀 20%", () => {
    const d = getShopDetail(9)!;
    expect(d.sells).toHaveLength(13);
    const sword = d.sells.find((e) => e.itemId === 20001)!;
    expect(sword.itemName).toBe("青銅刀");
    expect(sword.price).toBe(150);
    expect(d.buys).toHaveLength(1);
    expect(d.buys[0]).toMatchObject({ itemId: 20001, rate: 20 });
  });

  it("不存在的商店回傳 null", () => {
    expect(getShopDetail(99999)).toBeNull();
  });
});

describe("getShopsSellingItem", () => {
  it("青銅刀(20001)由 2 家販售,依價格排序(130 → 150)", () => {
    const rows = getShopsSellingItem(20001);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ shopId: 2, price: 130 });
    expect(rows[1]).toMatchObject({ shopId: 9, price: 150 });
  });

  it("無人販售的道具回傳空陣列", () => {
    expect(getShopsSellingItem(999999)).toEqual([]);
  });
});

describe("getShopsBuyingItem", () => {
  it("青銅刀(20001)由 4 家收購,rate 皆 20", () => {
    const rows = getShopsBuyingItem(20001);
    expect(rows).toHaveLength(4);
    expect(rows.map((r) => r.shopId).sort((a, b) => a - b)).toEqual([1, 2, 6, 9]);
    for (const r of rows) expect(r.rate).toBe(20);
  });
});
