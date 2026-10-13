import { getDb } from "@/lib/db";
import { shopCurrencyKind, shopKindOf } from "@/lib/constants/shop";
import type {
  ItemShopSale,
  ShopCurrency,
  ShopDetail,
  ShopNpcInfo,
  ShopSummary,
} from "@/lib/types/shop";

let shopNpcCache: Map<number, ShopNpcInfo> | undefined;

function getShopNpcInfo(shopId: number): ShopNpcInfo {
  if (!shopNpcCache) {
    const db = getDb();
    const names = db.prepare(
      // 開店訊息本身沒標說話者（兌換/活動店常見）時，改取上一句對話的 NPC。
      // ponytail: 只回溯一層；更深層多半是「解任務npc」這類泛用名，不採用。
      `WITH open_msgs AS (
         SELECT t.a0 AS shopId, m.file_no, m.msg_id, ns.name
         FROM trigger_ops t
         JOIN messages m ON m.file_no = t.file_no AND m.msg_id = t.msg_id
         LEFT JOIN npc_strings ns ON ns.id = m.name_id AND ns.name <> ''
         WHERE t.kind = 'A' AND t.op = 5
       )
       SELECT shopId, name FROM open_msgs WHERE name IS NOT NULL
       UNION
       SELECT o.shopId, ns.name
       FROM open_msgs o
       JOIN dialogue_edges e ON e.to_msg = o.msg_id
       JOIN messages pm ON pm.file_no = o.file_no AND pm.msg_id = e.from_msg
       JOIN npc_strings ns ON ns.id = pm.name_id AND ns.name <> ''
       WHERE o.name IS NULL
       ORDER BY 1, 2`,
    ).all() as Array<{ shopId: number; name: string }>;
    const cache = new Map<number, ShopNpcInfo>();
    for (const row of names) {
      const info = cache.get(row.shopId) ?? { npcNames: [], location: null };
      info.npcNames.push(row.name);
      cache.set(row.shopId, info);
    }

    // ponytail: 位置僅能依 NPC 名稱比對；總配置筆數非一筆就不顯示，精確對應需資料提供 NPC ID。
    const placements = db.prepare(
      `SELECT p.stage_id AS stageId, p.stage_kind AS stageKind, s.name AS stageName,
              p.tile_x AS x, p.tile_y AS y
       FROM map_placements p
       LEFT JOIN stages s ON s.kind = p.stage_kind AND s.id = p.stage_id
       WHERE p.category = 'npc' AND p.npc_id IN (
         SELECT id FROM npc WHERE name IN (SELECT value FROM json_each(?))
       )
       LIMIT 2`,
    );
    for (const info of cache.values()) {
      const rows = placements.all(JSON.stringify(info.npcNames)) as Array<
        NonNullable<ShopNpcInfo["location"]>
      >;
      if (rows.length === 1 && rows[0].stageName && rows[0].x != null && rows[0].y != null) {
        info.location = rows[0];
      }
    }
    shopNpcCache = cache;
  }
  return shopNpcCache.get(shopId) ?? { npcNames: [], location: null };
}

/** 全部商店 + 販售種數彙總,依 id 排序。 */
export function getShops(): ShopSummary[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT s.id,
              s.castle_id AS castleId,
              s.style0    AS style0,
              cur.name    AS currencyItemName,
              (SELECT COUNT(*) FROM shop_sells ss WHERE ss.shop_id = s.id) AS sellCount,
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
    mainType: string | null;
  }>;
  return rows.map((r) => {
    const currencyKind = shopCurrencyKind(r.style0);
    return {
      id: r.id,
      ...getShopNpcInfo(r.id),
      castleId: r.castleId,
      kind: shopKindOf(r.id),
      currency: {
        kind: currencyKind,
        itemId: currencyKind === "item" ? r.style0 : null,
        itemName: currencyKind === "item" ? r.currencyItemName : null,
      },
      mainType: r.mainType,
      sellCount: r.sellCount,
    };
  });
}

/** 全部商店 id（sitemap 用的輕量查詢）。 */
export function getAllShopIds(): number[] {
  const db = getDb();
  return (db.prepare(`SELECT id FROM shops`).all() as { id: number }[]).map((r) => r.id);
}

/** 單一商店 + 販售清單(依售價);不存在回傳 null。 */
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

  return {
    id: shop.id,
    ...getShopNpcInfo(shop.id),
    castleId: shop.castleId,
    kind: shopKindOf(shop.id),
    currency,
    mainType: shop.mainType,
    sells,
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
      npcNames: getShopNpcInfo(r.shopId).npcNames,
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
