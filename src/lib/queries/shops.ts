import { getDb } from "@/lib/db";
import { shopKindOf } from "@/lib/constants/shop";
import type {
  ItemShopBuy,
  ItemShopSale,
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
              (SELECT COUNT(*) FROM shop_sells ss WHERE ss.shop_id = s.id) AS sellCount,
              (SELECT COUNT(*) FROM shop_buys sb WHERE sb.shop_id = s.id)  AS buyCount
       FROM shops s
       ORDER BY s.id`,
    )
    .all() as Array<{ id: number; castleId: number | null; sellCount: number; buyCount: number }>;
  return rows.map((r) => ({ ...r, kind: shopKindOf(r.id) }));
}

/** 單一商店 + 販售(依價格)與收購清單;不存在回傳 null。 */
export function getShopDetail(id: number): ShopDetail | null {
  const db = getDb();
  const shop = db
    .prepare(`SELECT id, castle_id AS castleId FROM shops WHERE id = ?`)
    .get(id) as { id: number; castleId: number | null } | undefined;
  if (!shop) return null;

  const sells = db
    .prepare(
      `SELECT ss.item_id  AS itemId,
              i.name      AS itemName,
              i.type_name AS itemType,
              ss.price
       FROM shop_sells ss
       LEFT JOIN items i ON i.id = ss.item_id
       WHERE ss.shop_id = ?
       ORDER BY ss.price, ss.item_id`,
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

  return { id: shop.id, castleId: shop.castleId, kind: shopKindOf(shop.id), sells, buys };
}

/** 販售此道具的商店(道具頁用),依價格排序。 */
export function getShopsSellingItem(itemId: number): ItemShopSale[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT ss.shop_id  AS shopId,
              s.castle_id AS castleId,
              ss.price
       FROM shop_sells ss
       JOIN shops s ON s.id = ss.shop_id
       WHERE ss.item_id = ?
       ORDER BY ss.price, ss.shop_id`,
    )
    .all(itemId) as Array<{ shopId: number; castleId: number | null; price: number }>;
  return rows.map((r) => ({ ...r, kind: shopKindOf(r.shopId) }));
}

/** 收購此道具的商店(道具頁用),依 rate 高→低排序。 */
export function getShopsBuyingItem(itemId: number): ItemShopBuy[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT sb.shop_id  AS shopId,
              s.castle_id AS castleId,
              sb.rate
       FROM shop_buys sb
       JOIN shops s ON s.id = sb.shop_id
       WHERE sb.item_id = ?
       ORDER BY sb.rate DESC, sb.shop_id`,
    )
    .all(itemId) as Array<{ shopId: number; castleId: number | null; rate: number }>;
  return rows.map((r) => ({ ...r, kind: shopKindOf(r.shopId) }));
}
