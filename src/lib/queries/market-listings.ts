import { getDb } from "@/lib/db";
import { SERVERS } from "@/lib/market-price";
import {
  SHOWCASE_PRICE,
  baseAttributes,
  parseListingData,
  type MarketItemInfo,
  type MarketListing,
  type MarketScan,
} from "@/lib/market-listings";
import { getItemsByIds } from "@/lib/queries/items";
import { getItemIconMap, type EntityImage } from "@/lib/queries/images";
import { bonusLabel, parseModProb } from "@/lib/queries/compound";
import { getUserDb } from "@/lib/user-db";
import type { ServerId } from "./market-prices";

// 市集掛單的讀取端。寫入端是 market-scans.ts（POST /api/market/scans）。
// 一律只讀每個伺服器「最新一筆」掃描：同一攤每次掃描都會重複出現，跨掃描加總會重複計算。

type ScanRow = { scan_id: number; server: ServerId; started: number };

/** 每個伺服器最新一筆掃描；沒有掃描資料的伺服器不會出現。依 SERVERS 的順序排。 */
export function getLatestScans(): MarketScan[] {
  const db = getUserDb();
  const rows = db
    .prepare(
      `SELECT s.scan_id, s.server, s.started
       FROM market_scans s
       WHERE s.scan_id = (SELECT MAX(scan_id) FROM market_scans WHERE server = s.server)`,
    )
    .all() as ScanRow[];
  const order = SERVERS.map((s) => s.id);
  return rows
    .filter((r) => order.includes(r.server))
    .sort((a, b) => order.indexOf(a.server) - order.indexOf(b.server))
    .map((r) => ({ scanId: r.scan_id, server: r.server, started: r.started }));
}

type ListingRow = {
  owner_hash: string;
  item_id: number;
  price: number;
  count: number;
  strengthen: number;
  data: string | null;
  sign: string | null;
  name: string | null;
};

function toListing(row: ListingRow): MarketListing {
  return {
    ownerHash: row.owner_hash,
    itemId: row.item_id,
    price: row.price,
    count: row.count,
    strengthen: row.strengthen,
    ...parseListingData(row.data),
    sign: row.sign,
    name: row.name,
  };
}

// 攤位用 LEFT JOIN：2026-11-18 以前的掃描沒有攤位資料，商品照樣列出、招牌與名稱為 null。
const LISTING_SELECT = `SELECT l.owner_hash, l.item_id, l.price, l.count, l.strengthen, l.data,
         st.sign, st.name
       FROM market_listings l
       LEFT JOIN market_stalls st ON st.scan_id = l.scan_id AND st.owner_hash = l.owner_hash`;

/** 某次掃描的全部掛單（已排除展示價），由便宜到貴。 */
export function getScanListings(scanId: number): MarketListing[] {
  const db = getUserDb();
  const rows = db
    .prepare(
      `${LISTING_SELECT}
       WHERE l.scan_id = ? AND l.price < ?
       ORDER BY l.price, l.rowid`,
    )
    .all(scanId, SHOWCASE_PRICE) as ListingRow[];
  return rows.map(toListing);
}

/**
 * 某次掃描裡一個攤位的全部掛單（已排除展示價），由便宜到貴；排序與 getScanListings 一致。
 * owner_hash 只在同一次掃描內有意義（攤主重登就換），找不到時回空陣列，不跨掃描找。
 */
export function getStallListings(scanId: number, ownerHash: string): MarketListing[] {
  const db = getUserDb();
  const rows = db
    .prepare(
      `${LISTING_SELECT}
       WHERE l.scan_id = ? AND l.owner_hash = ? AND l.price < ?
       ORDER BY l.price, l.rowid`,
    )
    .all(scanId, ownerHash, SHOWCASE_PRICE) as ListingRow[];
  return rows.map(toListing);
}

/** 某道具在各伺服器最新掃描裡的掛單；有掃描但這件沒人賣的伺服器回空陣列。 */
export function getItemListings(itemId: number): { scan: MarketScan; listings: MarketListing[] }[] {
  const db = getUserDb();
  const stmt = db.prepare(
    `${LISTING_SELECT}
     WHERE l.scan_id = ? AND l.item_id = ? AND l.price < ?
     ORDER BY l.price, l.rowid`,
  );
  return getLatestScans().map((scan) => ({
    scan,
    listings: (stmt.all(scan.scanId, itemId, SHOWCASE_PRICE) as ListingRow[]).map(toListing),
  }));
}

export type StoneInfo = {
  id: number;
  name: string;
  /** 例如「玄學 +10 至 15」；配方沒有屬性加成（例如還原類）時為 null */
  effect: string | null;
  icon: EntityImage | null;
};

type StoneRow = {
  id: number;
  name: string | null;
  material_core_id: number | null;
  mod_prob: string | null;
};

/** 鑲嵌的真元／魂石（compounds.id）→ 名稱、效果、圖示。圖示取主材料道具的 icon。 */
export function getStoneInfo(ids: readonly number[]): Map<number, StoneInfo> {
  const unique = [...new Set(ids)];
  const map = new Map<number, StoneInfo>();
  if (unique.length === 0) return map;
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, name, material_core_id, mod_prob FROM compounds
       WHERE id IN (${unique.map(() => "?").join(",")})`,
    )
    .all(...unique) as StoneRow[];
  const icons = getItemIconMap(
    rows.map((r) => r.material_core_id).filter((id): id is number => id != null),
  );
  for (const row of rows) {
    // 同一屬性分好幾段機率（例如體力 +50~250、+250~500…），合成整段範圍。
    const ranges = new Map<string, [number, number]>();
    for (const p of parseModProb(row.mod_prob)) {
      const label = bonusLabel(p.type);
      if (!label || p.type === "ITEM_BONUS_CREATEITEM" || p.min == null || p.max == null) continue;
      if (!((p.prob ?? 0) > 0)) continue;
      const prev = ranges.get(label);
      ranges.set(
        label,
        prev ? [Math.min(prev[0], p.min), Math.max(prev[1], p.max)] : [p.min, p.max],
      );
    }
    const effect = [...ranges]
      .map(([label, [min, max]]) =>
        min === max ? `${label} +${min}` : `${label} +${min} 至 ${max}`,
      )
      .join("、");
    map.set(row.id, {
      id: row.id,
      name: row.name ?? `#${row.id}`,
      effect: effect || null,
      icon: row.material_core_id != null ? (icons.get(row.material_core_id) ?? null) : null,
    });
  }
  return map;
}
/** 掛單上的道具 → 名稱、類型、等級、基礎能力與圖示（遊戲資料庫）。 */
export function getMarketItemInfo(ids: readonly number[]): Map<number, MarketItemInfo> {
  const unique = [...new Set(ids)];
  const icons = getItemIconMap(unique);
  const map = new Map<number, MarketItemInfo>();
  for (const item of getItemsByIds(unique)) {
    map.set(item.id, {
      id: item.id,
      name: item.name,
      type: item.type,
      level: item.level,
      attributes: baseAttributes(item),
      icon: icons.get(item.id) ?? null,
    });
  }
  return map;
}
