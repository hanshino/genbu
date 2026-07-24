import { getDb } from "@/lib/db";
import { shopCurrencyKind, shopKindOf } from "@/lib/constants/shop";
import type {
  ItemShopBuy,
  ItemShopSale,
  ShopCurrency,
  ShopDetail,
  ShopSummary,
} from "@/lib/types/shop";

/** 全部商店 + 販售/收購種數彙總,依 id 排序。 */
export function getShops(): ShopSummary[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT s.id,
              s.castle_id AS castleId,
              s.style0    AS style0,
              cur.name    AS currencyItemName,
              (SELECT COUNT(*) FROM shop_sells ss WHERE ss.shop_id = s.id) AS sellCount,
              (SELECT COUNT(*) FROM shop_buys sb WHERE sb.shop_id = s.id)  AS buyCount,
              (SELECT i.type_name
               FROM shop_sells ss JOIN items i ON i.id = ss.item_id
               WHERE ss.shop_id = s.id AND i.type_name IS NOT NULL AND i.type_name <> ''
               GROUP BY i.type_name
               ORDER BY COUNT(*) DESC, i.type_name
               LIMIT 1) AS mainType
       FROM shops s
       LEFT JOIN items cur ON cur.id = s.style0 AND s.style0 > 100
       ORDER BY s.id`,
    )
    .all() as Array<{
    id: number;
    castleId: number | null;
    style0: number | null;
    currencyItemName: string | null;
    sellCount: number;
    buyCount: number;
    mainType: string | null;
  }>;
  return rows.map((r) => {
    const currencyKind = shopCurrencyKind(r.style0);
    return {
      id: r.id,
      castleId: r.castleId,
      kind: shopKindOf(r.id),
      currency: {
        kind: currencyKind,
        itemId: currencyKind === "item" ? r.style0 : null,
        itemName: currencyKind === "item" ? r.currencyItemName : null,
      },
      mainType: r.mainType,
      sellCount: r.sellCount,
      buyCount: r.buyCount,
    };
  });
}

/** 單一商店 + 販售(依售價)與收購清單;不存在回傳 null。 */
export function getShopDetail(id: number): ShopDetail | null {
  const db = getDb();
  const shop = db
    .prepare(
      `SELECT sh.id,
              sh.castle_id AS castleId,
              sh.style0    AS style0,
              cur.name     AS currencyItemName,
              (SELECT i.type_name
               FROM shop_sells ss JOIN items i ON i.id = ss.item_id
               WHERE ss.shop_id = sh.id AND i.type_name IS NOT NULL AND i.type_name <> ''
               GROUP BY i.type_name
               ORDER BY COUNT(*) DESC, i.type_name
               LIMIT 1) AS mainType
       FROM shops sh
       LEFT JOIN items cur ON cur.id = sh.style0 AND sh.style0 > 100
       WHERE sh.id = ?`,
    )
    .get(id) as
    | {
        id: number;
        castleId: number | null;
        style0: number | null;
        currencyItemName: string | null;
        mainType: string | null;
      }
    | undefined;
  if (!shop) return null;

  const currencyKind = shopCurrencyKind(shop.style0);
  const currency: ShopCurrency = {
    kind: currencyKind,
    itemId: currencyKind === "item" ? shop.style0 : null,
    itemName: currencyKind === "item" ? shop.currencyItemName : null,
  };

  // real_price 才是玩家看到的售價;price 是基礎價值百分比 rate,僅內部保留。
  const sells = db
    .prepare(
      `SELECT ss.item_id   AS itemId,
              i.name       AS itemName,
              i.type_name  AS itemType,
              ss.real_price AS price,
              ss.price      AS rate
       FROM shop_sells ss
       LEFT JOIN items i ON i.id = ss.item_id
       WHERE ss.shop_id = ?
       ORDER BY ss.real_price, ss.item_id`,
    )
    .all(id) as ShopDetail["sells"];

  const buys = db
    .prepare(
      `SELECT sb.item_id AS itemId,
              i.name     AS itemName,
              sb.rate
       FROM shop_buys sb
       LEFT JOIN items i ON i.id = sb.item_id
       WHERE sb.shop_id = ?
       ORDER BY sb.item_id`,
    )
    .all(id) as ShopDetail["buys"];

  return {
    id: shop.id,
    castleId: shop.castleId,
    kind: shopKindOf(shop.id),
    currency,
    mainType: shop.mainType,
    sells,
    buys,
  };
}

/** 販售此道具的商店(道具頁用),依售價排序。 */
export function getShopsSellingItem(itemId: number): ItemShopSale[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT ss.shop_id   AS shopId,
              s.castle_id  AS castleId,
              ss.real_price AS price,
              ss.price      AS rate,
              s.style0      AS style0,
              cur.name      AS currencyItemName
       FROM shop_sells ss
       JOIN shops s ON s.id = ss.shop_id
       LEFT JOIN items cur ON cur.id = s.style0 AND s.style0 > 100
       WHERE ss.item_id = ?
       ORDER BY ss.real_price, ss.shop_id`,
    )
    .all(itemId) as Array<{
    shopId: number;
    castleId: number | null;
    price: number;
    rate: number;
    style0: number | null;
    currencyItemName: string | null;
  }>;
  return rows.map((r) => {
    const currencyKind = shopCurrencyKind(r.style0);
    return {
      shopId: r.shopId,
      castleId: r.castleId,
      kind: shopKindOf(r.shopId),
      price: r.price,
      rate: r.rate,
      currency: {
        kind: currencyKind,
        itemId: currencyKind === "item" ? r.style0 : null,
        itemName: currencyKind === "item" ? r.currencyItemName : null,
      },
    };
  });
}

/** 收購此道具的商店(道具頁用),依 rate 高→低排序。 */
export function getShopsBuyingItem(itemId: number): ItemShopBuy[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT sb.shop_id  AS shopId,
              s.castle_id AS castleId,
              sb.rate,
              s.style0    AS style0,
              cur.name    AS currencyItemName
       FROM shop_buys sb
       JOIN shops s ON s.id = sb.shop_id
       LEFT JOIN items cur ON cur.id = s.style0 AND s.style0 > 100
       WHERE sb.item_id = ?
       ORDER BY sb.rate DESC, sb.shop_id`,
    )
    .all(itemId) as Array<{
    shopId: number;
    castleId: number | null;
    rate: number;
    style0: number | null;
    currencyItemName: string | null;
  }>;
  return rows.map((r) => {
    const currencyKind = shopCurrencyKind(r.style0);
    return {
      shopId: r.shopId,
      castleId: r.castleId,
      kind: shopKindOf(r.shopId),
      rate: r.rate,
      currency: {
        kind: currencyKind,
        itemId: currencyKind === "item" ? r.style0 : null,
        itemName: currencyKind === "item" ? r.currencyItemName : null,
      },
    };
  });
}
