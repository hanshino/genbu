import { getDb } from "@/lib/db";
import type {
  MonsterDetail,
  MonsterDropItem,
  MonsterDropSource,
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
  page?: number;
  pageSize?: number;
}

export interface GetMonstersResult {
  monsters: MonsterSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const DEFAULT_PAGE_SIZE = 20;

// 怪物列表：INNER JOIN monsters 確保只列出可戰鬥的 NPC（過濾掉 2242 筆販售/任務 NPC）
export function getMonsters(params: GetMonstersParams = {}): GetMonstersResult {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.max(1, Math.min(100, params.pageSize ?? DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * pageSize;

  const conditions: string[] = [];
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
    conditions.push("m.drop_item IS NOT NULL AND m.drop_item != '[]'");
  }

  if (params.isNormal) {
    conditions.push("(n.name LIKE '▲%' OR n.name LIKE '●%')");
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const db = getDb();

  const total = (
    db
      .prepare(`SELECT COUNT(*) AS c FROM npc n INNER JOIN monsters m ON n.id = m.id ${whereSql}`)
      .get(...args) as { c: number }
  ).c;

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
       INNER JOIN monsters m ON n.id = m.id
       ${whereSql}
       ORDER BY n.level ASC, n.id ASC
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

// 單一怪物詳情：回 npc 全欄位 + monsters.drop_item。不存在則 null。
export function getMonsterById(id: number): MonsterDetail | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT n.*, m.drop_item
       FROM npc n
       INNER JOIN monsters m ON n.id = m.id
       WHERE n.id = ?`,
    )
    .get(id) as MonsterDetail | undefined;
  return row ?? null;
}

// 怪物掉落物清單（rate 降冪，JOIN items 取名稱）
export function getDropsForMonster(monsterId: number): MonsterDropItem[] {
  const db = getDb();
  const row = db.prepare(`SELECT drop_item FROM monsters WHERE id = ?`).get(monsterId) as
    | { drop_item: string | null }
    | undefined;
  if (!row) return [];
  // itemId=0 在遊戲掉落表代表「空槽（沒掉落）」，機率通常最高，不應顯示為道具。
  const pairs = parseDropItem(row.drop_item).filter((p) => p.itemId !== 0);
  if (pairs.length === 0) return [];

  const ids = pairs.map((p) => p.itemId);
  const placeholders = ids.map(() => "?").join(",");
  const items = db
    .prepare(`SELECT id, name, type, level FROM items WHERE id IN (${placeholders})`)
    .all(...ids) as Array<{
    id: number;
    name: string | null;
    type: string | null;
    level: number | null;
  }>;
  const itemMap = new Map(items.map((i) => [i.id, i]));

  return pairs
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
}

// npc.type 有出現的值（facet 用）
export function getDistinctMonsterTypes(): number[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT DISTINCT n.type AS t FROM npc n INNER JOIN monsters m ON n.id = m.id WHERE n.type IS NOT NULL ORDER BY n.type ASC`,
    )
    .all() as { t: number }[];
  return rows.map((r) => r.t);
}

// npc.elemental 出現的值
export function getDistinctElementals(): string[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT DISTINCT n.elemental AS e FROM npc n INNER JOIN monsters m ON n.id = m.id WHERE n.elemental IS NOT NULL AND n.elemental != '' ORDER BY n.elemental ASC`,
    )
    .all() as { e: string }[];
  return rows.map((r) => r.e);
}
