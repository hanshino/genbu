import { getDb } from "@/lib/db";
import type { Item, ItemRand } from "@/lib/types/item";

export interface GetItemsParams {
  search?: string;
  type?: string;
  page?: number;
  pageSize?: number;
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

  const items = db
    .prepare(
      `SELECT * FROM items ${whereSql} ORDER BY level DESC, id ASC LIMIT ? OFFSET ?`
    )
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
