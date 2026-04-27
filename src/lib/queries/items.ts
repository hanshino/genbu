import { getDb } from "@/lib/db";
import { buildOrderBy, type SortDir } from "@/lib/sort";
import type { Item, ItemRand } from "@/lib/types/item";

// Columns required by ranking/compare UI: identity + level + all numeric
// attributes used in scoring/display. Excludes picture/icon/summary/note/
// durability/value to reduce payload size.
export const RANKING_ITEM_COLUMNS = [
  "id",
  "name",
  "type",
  "level",
  "weight",
  "hp",
  "mp",
  "str",
  "pow",
  "vit",
  "dex",
  "agi",
  "wis",
  "atk",
  "matk",
  "def",
  "mdef",
  "dodge",
  "uncanny_dodge",
  "critical",
  "hit",
  "speed",
  "fire",
  "water",
  "thunder",
  "tree",
  "freeze",
  "min_damage",
  "max_damage",
  "min_pdamage",
  "max_pdamage",
] as const;

export type RankingItem = Pick<Item, (typeof RANKING_ITEM_COLUMNS)[number]>;

const ITEM_SORT_ALLOWLIST: Record<string, string> = {
  level: "level",
  weight: "weight",
  id: "id",
};

export interface GetItemsParams {
  search?: string;
  type?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: SortDir;
}

export interface GetItemsResult {
  items: Item[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const DEFAULT_PAGE_SIZE = 20;

export function getItems(params: GetItemsParams = {}): GetItemsResult {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.max(1, Math.min(100, params.pageSize ?? DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * pageSize;

  const conditions: string[] = [];
  const args: (string | number)[] = [];

  if (params.search && params.search.trim().length > 0) {
    const q = params.search.trim();
    // 支援 ID 或名稱搜尋
    const asNumber = Number(q);
    if (Number.isInteger(asNumber) && asNumber > 0) {
      conditions.push("(id = ? OR name LIKE ?)");
      args.push(asNumber, `%${q}%`);
    } else {
      conditions.push("name LIKE ?");
      args.push(`%${q}%`);
    }
  }

  if (params.type) {
    conditions.push("type = ?");
    args.push(params.type);
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const db = getDb();

  const total = (
    db.prepare(`SELECT COUNT(*) AS c FROM items ${whereSql}`).get(...args) as { c: number }
  ).c;

  const orderBy = buildOrderBy({
    allowlist: ITEM_SORT_ALLOWLIST,
    sortBy: params.sortBy,
    sortDir: params.sortDir,
    defaultOrderBy: "level DESC, id ASC",
    idColumn: "id",
  });

  const items = db
    .prepare(`SELECT * FROM items ${whereSql} ${orderBy} LIMIT ? OFFSET ?`)
    .all(...args, pageSize, offset) as Item[];

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export function getItemById(id: number): Item | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM items WHERE id = ?").get(id) as Item | undefined;
  return row ?? null;
}

export function getItemRands(itemId: string): ItemRand[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM item_rand WHERE id = ? ORDER BY rate DESC")
    .all(itemId) as ItemRand[];
}

export function getItemsByType(type: string): RankingItem[] {
  const db = getDb();
  const cols = RANKING_ITEM_COLUMNS.join(", ");
  return db
    .prepare(`SELECT ${cols} FROM items WHERE type = ? ORDER BY level DESC, id ASC`)
    .all(type) as RankingItem[];
}

export function getItemsByIds(ids: readonly number[]): Item[] {
  if (ids.length === 0) return [];
  const db = getDb();
  const placeholders = ids.map(() => "?").join(",");
  return db.prepare(`SELECT * FROM items WHERE id IN (${placeholders})`).all(...ids) as Item[];
}

export function getItemRandsByIds(ids: readonly number[]): ItemRand[] {
  if (ids.length === 0) return [];
  const db = getDb();
  const stringIds = ids.map(String);
  const placeholders = stringIds.map(() => "?").join(",");
  return db
    .prepare(`SELECT * FROM item_rand WHERE id IN (${placeholders}) ORDER BY rate DESC`)
    .all(...stringIds) as ItemRand[];
}
