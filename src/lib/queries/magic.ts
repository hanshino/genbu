import { getDb } from "@/lib/db";
import type { Magic, MagicSummary } from "@/lib/types/magic";

export interface GetSkillsParams {
  search?: string;
  clan?: string;
  target?: string;
  page?: number;
  pageSize?: number;
}

export interface GetSkillsResult {
  skills: MagicSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const DEFAULT_PAGE_SIZE = 20;

// 列表頁：collapse by id，聚合最高 level。
// 其他欄位（name/clan/clan2/skill_type/attrib/target）在同 id 下為常數。
export function getSkills(params: GetSkillsParams = {}): GetSkillsResult {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.max(1, Math.min(100, params.pageSize ?? DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * pageSize;

  const conditions: string[] = [];
  const args: (string | number)[] = [];

  if (params.search && params.search.trim().length > 0) {
    const q = params.search.trim();
    const asNumber = Number(q);
    if (Number.isInteger(asNumber) && asNumber > 0) {
      conditions.push("(id = ? OR name LIKE ?)");
      args.push(asNumber, `%${q}%`);
    } else {
      conditions.push("name LIKE ?");
      args.push(`%${q}%`);
    }
  }

  if (params.clan) {
    conditions.push("clan = ?");
    args.push(params.clan);
  }

  if (params.target) {
    conditions.push("target = ?");
    args.push(params.target);
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const db = getDb();

  // Total distinct skill count (grouped by id)
  const total = (
    db
      .prepare(`SELECT COUNT(*) AS c FROM (SELECT id FROM magic ${whereSql} GROUP BY id)`)
      .get(...args) as { c: number }
  ).c;

  const rows = db
    .prepare(
      `SELECT id,
              name,
              clan,
              clan2,
              skill_type,
              attrib,
              target,
              MAX(level) AS maxLevel
       FROM magic
       ${whereSql}
       GROUP BY id
       ORDER BY maxLevel DESC, id ASC
       LIMIT ? OFFSET ?`,
    )
    .all(...args, pageSize, offset) as MagicSummary[];

  return {
    skills: rows,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

// 單一技能：回所有 level 行，level ASC。不存在回空陣列。
export function getSkillById(id: number): Magic[] {
  const db = getDb();
  return db.prepare(`SELECT * FROM magic WHERE id = ? ORDER BY level ASC`).all(id) as Magic[];
}

// 同門派其他技能（詳情頁側欄）。回最高 level 行。
export function getSkillsByClan(
  clan: string,
  excludeId: number | null = null,
  limit = 10,
): MagicSummary[] {
  const db = getDb();
  const args: (string | number)[] = [clan];
  let excludeSql = "";
  if (excludeId != null) {
    excludeSql = "AND id != ?";
    args.push(excludeId);
  }
  return db
    .prepare(
      `SELECT id,
              name,
              clan,
              clan2,
              skill_type,
              attrib,
              target,
              MAX(level) AS maxLevel
       FROM magic
       WHERE clan = ? ${excludeSql}
       GROUP BY id
       ORDER BY maxLevel DESC, id ASC
       LIMIT ?`,
    )
    .all(...args, limit) as MagicSummary[];
}

// DB 中出現的 clan 值（供 facet 下拉用）
export function getDistinctClans(): string[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT DISTINCT clan FROM magic WHERE clan IS NOT NULL AND clan != '' ORDER BY clan ASC`,
    )
    .all() as { clan: string }[];
  return rows.map((r) => r.clan);
}

// DB 中出現的 target 值
export function getDistinctTargets(): string[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT DISTINCT target FROM magic WHERE target IS NOT NULL AND target != '' ORDER BY target ASC`,
    )
    .all() as { target: string }[];
  return rows.map((r) => r.target);
}
