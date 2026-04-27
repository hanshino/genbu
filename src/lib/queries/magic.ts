import { getDb } from "@/lib/db";
import type { Magic, MagicSummary } from "@/lib/types/magic";

export interface GetSkillsParams {
  search?: string;
  clan?: string;
  target?: string;
  skillType?: number;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: string;
}

export interface GetSkillsResult {
  skills: MagicSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const DEFAULT_PAGE_SIZE = 20;

const SKILL_SORT_ALLOWLIST: Record<string, string> = {
  maxLevel: "maxLevel",
  id: "id",
};

// 列表頁：依 (id, name) 分組。magic 表沒有 PK，同 id 可能共用於多個無關技能
// （極端例：id=553 塞 32 個各自獨立的技能），所以不能純用 id 分組。
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

  if (params.skillType != null && Number.isInteger(params.skillType)) {
    conditions.push("skill_type = ?");
    args.push(params.skillType);
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const db = getDb();

  const total = (
    db
      .prepare(
        `SELECT COUNT(*) AS c FROM (SELECT id, name FROM magic ${whereSql} GROUP BY id, name)`,
      )
      .get(...args) as { c: number }
  ).c;

  const sortCol = params.sortBy ? (SKILL_SORT_ALLOWLIST[params.sortBy] ?? null) : null;
  const sortDirSql = params.sortDir === "desc" ? "DESC" : "ASC";
  // name tiebreak required: magic table's unique key is (id, name), not id alone.
  const orderBy = sortCol
    ? sortCol === "id"
      ? `ORDER BY id ${sortDirSql}, name ASC`
      : `ORDER BY ${sortCol} ${sortDirSql}, id ASC, name ASC`
    : `ORDER BY maxLevel DESC, id ASC, firstLevel ASC`;

  const rows = db
    .prepare(
      `SELECT id,
              name,
              clan,
              clan2,
              skill_type,
              attrib,
              target,
              MIN(level) AS firstLevel,
              MAX(level) AS maxLevel
       FROM magic
       ${whereSql}
       GROUP BY id, name
       ${orderBy}
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

// 舊介面：回某個 id 底下的全部 row，不管有沒有跨多個 name。詳情頁只用它當 fallback。
export function getSkillById(id: number): Magic[] {
  const db = getDb();
  return db.prepare(`SELECT * FROM magic WHERE id = ? ORDER BY level ASC`).all(id) as Magic[];
}

// (id, level) 是 magic 表的自然唯一 key，用來從 URL 的 ?level= 解出具體技能。
export function getSkillRow(id: number, level: number): Magic | null {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM magic WHERE id = ? AND level = ?`).get(id, level) as
    | Magic
    | undefined;
  return row ?? null;
}

// 一個技能 = (id, name) 對應的所有 level。順序 level ASC。
export function getSkillGroup(id: number, name: string): Magic[] {
  const db = getDb();
  return db
    .prepare(`SELECT * FROM magic WHERE id = ? AND name = ? ORDER BY level ASC`)
    .all(id, name) as Magic[];
}

export interface SkillExclude {
  id: number;
  name: string;
}

// 同門派其他技能（詳情頁側欄）。每個 (id, name) 一筆，排除當前技能。
export function getSkillsByClan(
  clan: string,
  exclude: SkillExclude | null = null,
  limit = 10,
): MagicSummary[] {
  const db = getDb();
  const args: (string | number)[] = [clan];
  let excludeSql = "";
  if (exclude) {
    excludeSql = "AND NOT (id = ? AND name = ?)";
    args.push(exclude.id, exclude.name);
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
              MIN(level) AS firstLevel,
              MAX(level) AS maxLevel
       FROM magic
       WHERE clan = ? ${excludeSql}
       GROUP BY id, name
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

// DB 中出現的 skill_type 值（1..20，null 代表修練/生活類，下拉不列）
export function getDistinctSkillTypes(): number[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT DISTINCT skill_type FROM magic WHERE skill_type IS NOT NULL ORDER BY skill_type ASC`,
    )
    .all() as { skill_type: number }[];
  return rows.map((r) => r.skill_type);
}

// 一批技能的命中率參數1 分布（給怪物頁的命中需求面板用）。
// 每筆 pick 以 (id, name) 定位；同 name 若有玩家版 + 特效版（例如 落英紛飛 id=714 vs id=1133 p1=500），
// picks 已經指向玩家 id，這裡不再做二次過濾。
export interface SkillHitInfo {
  id: number;
  name: string;
  firstLevel: number;
  minP1: number;
  maxP1: number;
}

export function getSkillHitInfoBatch(
  picks: readonly { id: number; name: string; firstLevel: number }[],
): SkillHitInfo[] {
  if (picks.length === 0) return [];
  const db = getDb();
  const placeholders = picks.map(() => "(?,?)").join(",");
  const args: (number | string)[] = [];
  for (const p of picks) args.push(p.id, p.name);
  const rows = db
    .prepare(
      `SELECT id, name, MIN(func_hit_p1) AS minP1, MAX(func_hit_p1) AS maxP1
       FROM magic
       WHERE (id, name) IN (VALUES ${placeholders})
         AND func_hit_p1 IS NOT NULL AND func_hit_p1 > 0
       GROUP BY id, name`,
    )
    .all(...args) as { id: number; name: string; minP1: number; maxP1: number }[];
  const byKey = new Map(rows.map((r) => [`${r.id}::${r.name}`, r]));
  // 依 picks 傳入順序回傳（和 SKILL_PICKS 的編排一致）；找不到的直接略過。
  return picks
    .map((p) => {
      const r = byKey.get(`${p.id}::${p.name}`);
      if (!r) return null;
      return { id: p.id, name: p.name, firstLevel: p.firstLevel, minP1: r.minP1, maxP1: r.maxP1 };
    })
    .filter((x): x is SkillHitInfo => x !== null);
}
