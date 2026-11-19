import { displayableAttributeKeys, itemAttributeNames } from "@/lib/constants/i18n";
import { getGroupForType } from "@/lib/constants/item-types";
import type { ServerId } from "@/lib/queries/market-prices";
import type { Item } from "@/lib/types/item";

/**
 * 市集掛單（tthol-headless 掃描）的顯示規則。
 *
 * 純函式，不碰 DB，Server Component、client 元件與測試都能直接用。
 */

export type RawSearchParams = Record<string, string | string[] | undefined>;

/** 網址重複帶同一個參數（?q=a&q=b）時 Next 給的是陣列；收成第一個字串，其餘參數原樣保留。 */
export function normalizeSearchParams(raw: RawSearchParams): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(raw)) out[k] = Array.isArray(v) ? v[0] : v;
  return out;
}

/** 9,999 萬以上是展示用的天價（遊戲上限 99,999,999 附近），讀取時排除，不動原始資料。 */
export const SHOWCASE_PRICE = 99_990_000;

/** 展示價不是真的要賣這個價，畫面上一律寫「議價」。 */
export function isShowcasePrice(price: number): boolean {
  return price >= SHOWCASE_PRICE;
}

/** 最新掃描超過 3 小時就提醒玩家掛單可能已經賣掉或改價。 */
export const STALE_AFTER_SECONDS = 3 * 3600;

export type MarketScan = {
  scanId: number;
  server: ServerId;
  /** Unix 秒 */
  started: number;
};

/** 卡片與清單要的道具資訊（遊戲資料庫），由伺服器端組好再往下傳。 */
export type MarketItemInfo = {
  id: number;
  name: string;
  type: string | null;
  level: number;
  attributes: { label: string; value: string }[];
  icon: { url: string; width: number | null; height: number | null } | null;
};

export type MarketListing = {
  ownerHash: string;
  itemId: number;
  /** 單價，銀兩 */
  price: number;
  count: number;
  strengthen: number;
  /** 附加素質，依 data.stats 的原順序；值為 0 也保留 */
  stats: [string, number][];
  /** 鑲嵌的 compounds.id，已略過空槽（0） */
  stones: number[];
  bindsLeft: number | null;
  refineLeft: number | null;
  zhenjie: boolean;
  /** 招牌；找不到攤位資料（舊掃描）時為 null */
  sign: string | null;
  /** 攤主名稱；沒有攤位資料或探子沒讀到時為 null */
  name: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** 掃描端送來的 data JSON 只信得過形狀，欄位缺漏或型別不對一律退回「沒有」。 */
export function parseListingData(
  raw: string | null,
): Pick<MarketListing, "stats" | "stones" | "bindsLeft" | "refineLeft" | "zhenjie"> {
  let data: unknown = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }
  const obj = isRecord(data) ? data : {};
  const stats = isRecord(obj.stats)
    ? Object.entries(obj.stats).filter(
        (entry): entry is [string, number] =>
          typeof entry[1] === "number" && Number.isFinite(entry[1]),
      )
    : [];
  const stones = Array.isArray(obj.stones)
    ? obj.stones.filter((id): id is number => Number.isInteger(id) && id > 0)
    : [];
  return {
    stats,
    stones,
    bindsLeft: finiteOrNull(obj.binds_left),
    refineLeft: finiteOrNull(obj.refine_left),
    zhenjie: obj.zhenjie != null,
  };
}

/** owner_hash 是 sha256(owner) 的 hex 前 16 碼；攤位頁網址先擋掉格式不對的。 */
export function isOwnerHash(value: string): boolean {
  return /^[0-9a-f]{16}$/.test(value);
}

/** 攤位的掛單筆數：遊戲資料庫查不到的道具不畫，也不算（同攤同價合併前，一格一筆）。 */
export function shownListingCount(
  listings: readonly MarketListing[],
  items: ReadonlyMap<number, unknown>,
): number {
  return listings.filter((l) => items.has(l.itemId)).length;
}

export function isStale(started: number, now: number = Date.now()): boolean {
  return now / 1000 - started > STALE_AFTER_SECONDS;
}

const EQUIPMENT_GROUPS = new Set(["weapon", "armor", "special", "accessory"]);

/** 道具類型屬於裝備（武器、防具、座騎背飾、飾品）。 */
export function isEquipmentType(type: string | null): boolean {
  return EQUIPMENT_GROUPS.has(getGroupForType(type)?.id ?? "");
}

/** 這筆掛單帶有個體差異，要用卡片把素質攤開，不能和別筆合併看。 */
export function isIndividualListing(listing: MarketListing, type: string | null): boolean {
  return (
    listing.stats.length > 0 ||
    listing.strengthen > 0 ||
    listing.stones.length > 0 ||
    isEquipmentType(type)
  );
}

export type PriceTick = {
  /** 0–100，刻度在線上的位置 */
  percent: number;
  /** 同價第幾筆（0 起），畫面上往右錯開並排 */
  stack: number;
};

export type PriceScale =
  | { kind: "single"; price: number; count: number }
  | { kind: "range"; min: number; max: number; ticks: PriceTick[] };

/** 價格刻度條：全部同價（含只有一筆）就退回單一價格，否則左最低、右最高線性排。 */
export function priceScale(prices: readonly number[]): PriceScale | null {
  if (prices.length === 0) return null;
  const sorted = [...prices].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  if (min === max) return { kind: "single", price: min, count: sorted.length };
  const seen = new Map<number, number>();
  const ticks = sorted.map((price) => {
    const stack = seen.get(price) ?? 0;
    seen.set(price, stack + 1);
    return { percent: ((price - min) / (max - min)) * 100, stack };
  });
  return { kind: "range", min, max, ticks };
}

/** 道具本身的基礎能力（非零欄位）；傷害上下限合成一列，排在最前面（武器最先看傷害）。 */
export function baseAttributes(item: Item): { label: string; value: string }[] {
  const damage: { label: string; value: string }[] = [];
  const out: { label: string; value: string }[] = [];
  const pairs: Record<string, [keyof Item, string]> = {
    min_damage: ["max_damage", "傷害"],
    min_pdamage: ["max_pdamage", "內勁傷害"],
  };
  for (const key of displayableAttributeKeys) {
    if (key === "max_damage" || key === "max_pdamage") continue;
    const pair = pairs[key];
    if (pair) {
      const lo = item[key];
      const hi = item[pair[0]] as number;
      if (lo === 0 && hi === 0) continue;
      damage.push({
        label: pair[1],
        value:
          lo === hi
            ? lo.toLocaleString("zh-TW")
            : `${lo.toLocaleString("zh-TW")} 至 ${hi.toLocaleString("zh-TW")}`,
      });
      continue;
    }
    const value = item[key];
    if (value === 0) continue;
    out.push({ label: itemAttributeNames[key] ?? key, value: value.toLocaleString("zh-TW") });
  }
  return [...damage, ...out];
}

/** 卡片底部的一行狀態：可綁定／可精煉次數、真解。 */
export function listingStateText(listing: MarketListing): string | null {
  const parts: string[] = [];
  if (listing.bindsLeft != null) {
    parts.push(listing.bindsLeft > 0 ? `可綁定 ${listing.bindsLeft} 次` : "不可再綁定");
  }
  if (listing.refineLeft != null) {
    parts.push(listing.refineLeft > 0 ? `可精煉 ${listing.refineLeft} 次` : "不可再精煉");
  }
  if (listing.zhenjie) parts.push("已真解");
  return parts.length > 0 ? parts.join("，") : null;
}

export type ItemSummary = {
  itemId: number;
  min: number;
  max: number;
  /** 攤數（同一攤多筆只算一次） */
  stalls: number;
  /** 件數（各筆數量加總） */
  pieces: number;
  listings: number;
};

/** /market 依道具：每種道具一列，依掛單筆數多到少，同筆數再依道具編號。 */
export function summarizeByItem(listings: readonly MarketListing[]): ItemSummary[] {
  const byItem = new Map<number, ItemSummary & { owners: Set<string> }>();
  for (const l of listings) {
    let row = byItem.get(l.itemId);
    if (!row) {
      row = {
        itemId: l.itemId,
        min: l.price,
        max: l.price,
        stalls: 0,
        pieces: 0,
        listings: 0,
        owners: new Set(),
      };
      byItem.set(l.itemId, row);
    }
    row.min = Math.min(row.min, l.price);
    row.max = Math.max(row.max, l.price);
    row.pieces += l.count;
    row.listings += 1;
    row.owners.add(l.ownerHash);
  }
  return [...byItem.values()]
    .map(({ owners, ...row }) => ({ ...row, stalls: owners.size }))
    .sort((a, b) => b.listings - a.listings || a.itemId - b.itemId);
}

export type StallSummary = {
  ownerHash: string;
  sign: string | null;
  name: string | null;
  listings: MarketListing[];
};

/** /market 依攤位：每攤一張，依商品筆數多到少。 */
export function groupByStall(listings: readonly MarketListing[]): StallSummary[] {
  const byOwner = new Map<string, StallSummary>();
  for (const l of listings) {
    let stall = byOwner.get(l.ownerHash);
    if (!stall) {
      stall = { ownerHash: l.ownerHash, sign: l.sign, name: l.name, listings: [] };
      byOwner.set(l.ownerHash, stall);
    }
    stall.listings.push(l);
  }
  return [...byOwner.values()].sort(
    (a, b) => b.listings.length - a.listings.length || a.ownerHash.localeCompare(b.ownerHash),
  );
}

/** /market 切換伺服器：保留 view、q 等條件，丟掉 group、page、stall、item（新伺服器不一定有同樣的類型群組、攤位或道具）。 */
export function switchServerParams(search: string, server: ServerId): URLSearchParams {
  const params = new URLSearchParams(search);
  params.set("server", server);
  for (const key of ["group", "page", "stall", "item"]) params.delete(key);
  return params;
}

/** 道具頁預設顯示的伺服器：第一個有這件道具掛單的；都沒有才用第一個。 */
export function pickDefaultServer(
  entries: readonly { server: ServerId; listings: readonly unknown[] }[],
): ServerId {
  return (entries.find((e) => e.listings.length > 0) ?? entries[0]).server;
}

/**
 * 一般道具同一攤常拆成好幾格同價擺（例如 4 格各 1 件），清單上合成一列、數量加總。
 * 只合併同一攤、同道具、同價、同綁定／精煉次數的；不同攤即使同價也各自一列。
 */
export function mergeStacks(listings: readonly MarketListing[]): MarketListing[] {
  const merged = new Map<string, MarketListing>();
  for (const l of listings) {
    const key = [l.ownerHash, l.itemId, l.price, l.bindsLeft, l.refineLeft].join("|");
    const prev = merged.get(key);
    if (prev) merged.set(key, { ...prev, count: prev.count + l.count });
    else merged.set(key, l);
  }
  return [...merged.values()];
}
