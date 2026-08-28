import { getDb } from "@/lib/db";
import { buildOrderBy, type SortDir } from "@/lib/sort";
import type { Item, ItemRand } from "@/lib/types/item";

// items 表欄位改名（新 schema），SQL 用 alias 把新欄位對回 app 舊 key，
// 沿用 monsters.ts（98c144b）同一手法：`Item` 型別與 i18n 不動。
const RENAMED_ITEM_COLUMNS: Record<string, string> = {
  type: "type_name",
  level: "base_lv",
  def: "extra_def",
  mdef: "magic_def",
  critical: "critical_hit",
  speed: "walk_speed",
  fire: "fire_def",
  water: "water_def",
  thunder: "lightning_def",
  tree: "wood_def",
  min_damage: "damage_min",
  max_damage: "damage_max",
  min_pdamage: "pdamage_min",
  max_pdamage: "pdamage_max",
};

// ponytail: 抗定（freeze）在新 schema 已不存在，恆回 0 只為讓 Item 型別的 key 有值；
// 顯示層對 0 值做 filter 會自動濾掉，日後確定要拿掉再連 i18n 一起清。
function itemColumnExpr(key: string): string {
  if (key === "freeze") return "0 AS freeze";
  const renamed = RENAMED_ITEM_COLUMNS[key];
  return renamed ? `${renamed} AS ${key}` : key;
}

// SELECT * 已含所有欄位，這裡只需額外 alias 改名過的欄位（含 freeze）覆蓋掉 SELECT * 撈不到的舊名。
const RENAMED_ITEM_ALIASES_SQL = [...Object.keys(RENAMED_ITEM_COLUMNS), "freeze"]
  .map(itemColumnExpr)
  .join(", ");

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
  level: "base_lv",
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
  /**
   * 只套用搜尋字、不套用任何篩選時的總筆數。
   * 僅在「有篩選 + 篩完 0 筆」時才會計算，其餘情況為 undefined（不多跑查詢）。
   */
  unfilteredTotal?: number;
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

  // 搜尋字自己的條件（不含篩選），供「清除篩選後會有幾筆」的 count 重用。
  const searchConditions = [...conditions];
  const searchArgs = [...args];

  if (params.type) {
    conditions.push("type_name = ?");
    args.push(params.type);
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const db = getDb();

  const countMatching = (conds: string[], a: (string | number)[]) =>
    (
      db
        .prepare(
          `SELECT COUNT(*) AS c FROM items ${conds.length > 0 ? `WHERE ${conds.join(" AND ")}` : ""}`,
        )
        .get(...a) as { c: number }
    ).c;

  const total = countMatching(conditions, args);

  // ponytail: 只有「有套篩選 + 篩完 0 筆」才會多跑這一次 count，
  // 有結果的正常路徑仍維持 count + list 兩句，不受影響。
  const filterActive = conditions.length > searchConditions.length;
  const unfilteredTotal =
    total === 0 && filterActive ? countMatching(searchConditions, searchArgs) : undefined;

  const orderBy = buildOrderBy({
    allowlist: ITEM_SORT_ALLOWLIST,
    sortBy: params.sortBy,
    sortDir: params.sortDir,
    defaultOrderBy: "base_lv DESC, id ASC",
    idColumn: "id",
  });

  const items = db
    .prepare(
      `SELECT *, ${RENAMED_ITEM_ALIASES_SQL} FROM items ${whereSql} ${orderBy} LIMIT ? OFFSET ?`,
    )
    .all(...args, pageSize, offset) as Item[];

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    unfilteredTotal,
  };
}

export function getItemById(id: number): Item | null {
  const db = getDb();
  const row = db
    .prepare(`SELECT *, ${RENAMED_ITEM_ALIASES_SQL} FROM items WHERE id = ?`)
    .get(id) as Item | undefined;
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
  const cols = RANKING_ITEM_COLUMNS.map(itemColumnExpr).join(", ");
  return db
    .prepare(`SELECT ${cols} FROM items WHERE type_name = ? ORDER BY base_lv DESC, id ASC`)
    .all(type) as RankingItem[];
}

export function getItemsByIds(ids: readonly number[]): Item[] {
  if (ids.length === 0) return [];
  const db = getDb();
  const placeholders = ids.map(() => "?").join(",");
  return db
    .prepare(`SELECT *, ${RENAMED_ITEM_ALIASES_SQL} FROM items WHERE id IN (${placeholders})`)
    .all(...ids) as Item[];
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
