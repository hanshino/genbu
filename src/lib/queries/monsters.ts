import { getDb } from "@/lib/db";
import { buildOrderBy, type SortDir } from "@/lib/sort";
import { MIN_MONSTER_LEVEL, MAX_MONSTER_LEVEL } from "@/lib/constants/monster-level";
import type {
  MonsterDetail,
  MonsterDropItem,
  MonsterDropSource,
  MonsterDropTable,
  MonsterSummary,
  NpcRow,
} from "@/lib/types/monster";

/**
 * drop_item JSON 格式: ["1", pair_count, item_id, rate, item_id, rate, ...]
 * 所有值為字串，需 Number 轉換。第一個元素固定 "1"，第二個為 pair 數量。
 * 空掉落為 "[]" 或 null。
 */
export function parseDropItem(json: string | null): { itemId: number; rate: number }[] {
  if (!json) return [];
  let arr: unknown;
  try {
    arr = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(arr) || arr.length < 2) return [];
  const pairCount = Number(arr[1]);
  if (!Number.isFinite(pairCount) || pairCount <= 0) return [];
  const pairs: { itemId: number; rate: number }[] = [];
  for (let i = 0; i < pairCount; i++) {
    const idRaw = arr[2 + i * 2];
    const rateRaw = arr[3 + i * 2];
    if (idRaw === undefined || rateRaw === undefined) break;
    const itemId = Number(idRaw);
    const rate = Number(rateRaw);
    if (Number.isFinite(itemId) && Number.isFinite(rate)) {
      pairs.push({ itemId, rate });
    }
  }
  return pairs;
}

export function getMonstersByDropItem(itemId: number): MonsterDropSource[] {
  const db = getDb();
  // 用 LIKE 先粗過濾，再解析確認。
  const rows = db
    .prepare(
      `SELECT n.id, n.name, n.level, m.drop_item
       FROM monsters m
       JOIN npc n ON m.id = n.id
       WHERE m.drop_item IS NOT NULL AND m.drop_item LIKE ?`,
    )
    .all(`%"${itemId}"%`) as Array<{ id: number; name: string; level: number; drop_item: string }>;

  const result: MonsterDropSource[] = [];
  for (const row of rows) {
    const pairs = parseDropItem(row.drop_item);
    const match = pairs.find((p) => p.itemId === itemId);
    if (match) {
      result.push({
        id: row.id,
        name: row.name,
        level: row.level,
        rate: match.rate,
      });
    }
  }
  result.sort((a, b) => b.rate - a.rate || a.level - b.level);
  return result;
}

export interface GetMonstersParams {
  search?: string;
  type?: number;
  elemental?: string;
  hasDrop?: boolean;
  isNormal?: boolean;
  /** 等級下限（含）。非數字/空 → 不限。會 clamp 到 [MIN_MONSTER_LEVEL, MAX_MONSTER_LEVEL]。 */
  levelMin?: number;
  /** 等級上限（含）。非數字/空 → 不限。會 clamp 到 [MIN_MONSTER_LEVEL, MAX_MONSTER_LEVEL]。 */
  levelMax?: number;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: SortDir;
}

// 把等級上下限正規化：非有限值 → undefined（不限）；各自 clamp 到 [MIN, MAX]；
// 兩者皆存在且 min > max 時自動對調（寬容處理，避免變成永遠 0 筆）。
function normalizeLevelBounds(
  min: number | undefined,
  max: number | undefined,
): { min?: number; max?: number } {
  const clamp = (v: number) =>
    Math.min(MAX_MONSTER_LEVEL, Math.max(MIN_MONSTER_LEVEL, Math.round(v)));
  let lo = typeof min === "number" && Number.isFinite(min) ? clamp(min) : undefined;
  let hi = typeof max === "number" && Number.isFinite(max) ? clamp(max) : undefined;
  if (lo !== undefined && hi !== undefined && lo > hi) [lo, hi] = [hi, lo];
  return { min: lo, max: hi };
}

const MONSTER_SORT_ALLOWLIST: Record<string, string> = {
  level: "n.level",
  hp: "n.hp",
  id: "n.id",
};

export interface GetMonstersResult {
  monsters: MonsterSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const DEFAULT_PAGE_SIZE = 20;

// 怪物列表：以 npc 為主表，LEFT JOIN monsters 取掉落資料（monsters 為舊資料，部分怪物無對應記錄）。
// type=0 為販售/任務 NPC，排除之。
export function getMonsters(params: GetMonstersParams = {}): GetMonstersResult {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.max(1, Math.min(100, params.pageSize ?? DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * pageSize;

  const conditions: string[] = ["n.type > 0"];
  const args: (string | number)[] = [];

  if (params.search && params.search.trim().length > 0) {
    const q = params.search.trim();
    const asNumber = Number(q);
    if (Number.isInteger(asNumber) && asNumber > 0) {
      conditions.push("(n.id = ? OR n.name LIKE ?)");
      args.push(asNumber, `%${q}%`);
    } else {
      conditions.push("n.name LIKE ?");
      args.push(`%${q}%`);
    }
  }

  if (params.type != null) {
    conditions.push("n.type = ?");
    args.push(params.type);
  }

  if (params.elemental) {
    conditions.push("n.elemental = ?");
    args.push(params.elemental);
  }

  if (params.hasDrop) {
    conditions.push("m.drop_item IS NOT NULL AND m.drop_item != '[]' AND m.drop_item != 'null'");
  }

  if (params.isNormal) {
    conditions.push("(n.name LIKE '▲%' OR n.name LIKE '●%')");
  }

  const { min: levelMin, max: levelMax } = normalizeLevelBounds(params.levelMin, params.levelMax);
  if (levelMin !== undefined) {
    conditions.push("n.level >= ?");
    args.push(levelMin);
  }
  if (levelMax !== undefined) {
    conditions.push("n.level <= ?");
    args.push(levelMax);
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const db = getDb();

  const total = (
    db
      .prepare(`SELECT COUNT(*) AS c FROM npc n LEFT JOIN monsters m ON n.id = m.id ${whereSql}`)
      .get(...args) as { c: number }
  ).c;

  const orderBy = buildOrderBy({
    allowlist: MONSTER_SORT_ALLOWLIST,
    sortBy: params.sortBy,
    sortDir: params.sortDir,
    defaultOrderBy: "n.level ASC, n.id ASC",
    idColumn: "n.id",
  });

  const rows = db
    .prepare(
      `SELECT n.id,
              n.name,
              n.level,
              n.type,
              n.elemental,
              n.hp,
              CASE
                WHEN m.drop_item IS NULL OR m.drop_item = '[]' THEN 0
                ELSE 1
              END AS hasDrop
       FROM npc n
       LEFT JOIN monsters m ON n.id = m.id
       ${whereSql}
       ${orderBy}
       LIMIT ? OFFSET ?`,
    )
    .all(...args, pageSize, offset) as Array<
    Pick<NpcRow, "id" | "name" | "level" | "type" | "elemental" | "hp"> & { hasDrop: 0 | 1 }
  >;

  return {
    monsters: rows.map((r) => ({
      id: r.id,
      name: r.name,
      level: r.level,
      type: r.type,
      elemental: r.elemental,
      hp: r.hp,
      hasDrop: r.hasDrop === 1,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

// 單一怪物詳情：npc 為主，LEFT JOIN monsters 取掉落資料。npc 不存在則 null。
export function getMonsterById(id: number): MonsterDetail | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT n.*, m.drop_item
       FROM npc n
       LEFT JOIN monsters m ON n.id = m.id
       WHERE n.id = ? AND n.type > 0`,
    )
    .get(id) as MonsterDetail | undefined;
  return row ?? null;
}

// 怪物掉落物清單（rate 降冪，JOIN items 取名稱）。
// totalWeight 包含 itemId=0 空槽 —— 是算真實百分比（含不掉落機率）的正確分母。
export function getDropsForMonster(monsterId: number): MonsterDropTable {
  const db = getDb();
  const row = db.prepare(`SELECT drop_item FROM monsters WHERE id = ?`).get(monsterId) as
    | { drop_item: string | null }
    | undefined;
  if (!row) return { drops: [], totalWeight: 0 };

  const allPairs = parseDropItem(row.drop_item);
  const totalWeight = allPairs.reduce((s, p) => s + p.rate, 0);

  // itemId=0 代表「空槽（沒掉落）」，不列為道具但仍計入 totalWeight。
  const pairs = allPairs.filter((p) => p.itemId !== 0);
  if (pairs.length === 0) return { drops: [], totalWeight };

  const ids = pairs.map((p) => p.itemId);
  const placeholders = ids.map(() => "?").join(",");
  const items = db
    .prepare(
      `SELECT id, name, type_name AS type, base_lv AS level FROM items WHERE id IN (${placeholders})`,
    )
    .all(...ids) as Array<{
    id: number;
    name: string | null;
    type: string | null;
    level: number | null;
  }>;
  const itemMap = new Map(items.map((i) => [i.id, i]));

  const drops: MonsterDropItem[] = pairs
    .map((p) => {
      const item = itemMap.get(p.itemId);
      return {
        itemId: p.itemId,
        name: item?.name ?? null,
        type: item?.type ?? null,
        level: item?.level ?? null,
        rate: p.rate,
      };
    })
    .sort((a, b) => b.rate - a.rate);

  return { drops, totalWeight };
}

// npc.type 有出現的值（facet 用）
export function getDistinctMonsterTypes(): number[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT DISTINCT n.type AS t FROM npc n LEFT JOIN monsters m ON n.id = m.id WHERE n.type > 0 ORDER BY n.type ASC`,
    )
    .all() as { t: number }[];
  return rows.map((r) => r.t);
}

// npc.elemental 出現的值
export function getDistinctElementals(): string[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT DISTINCT n.elemental AS e FROM npc n LEFT JOIN monsters m ON n.id = m.id WHERE n.type > 0 AND n.elemental IS NOT NULL AND n.elemental != '' ORDER BY n.elemental ASC`,
    )
    .all() as { e: string }[];
  return rows.map((r) => r.e);
}
