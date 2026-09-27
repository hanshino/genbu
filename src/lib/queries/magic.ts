import { getDb } from "@/lib/db";
import { buildOrderBy, type SortDir } from "@/lib/sort";
import { getStatusById } from "@/lib/queries/status";
import type { Magic, MagicSummary } from "@/lib/types/magic";
import type { StepSkill, StepSkillKind } from "@/lib/guide-steps";

export interface GetSkillsParams {
  search?: string;
  clan?: string;
  target?: string;
  skillType?: number;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: SortDir;
}

export interface GetSkillsResult {
  skills: MagicSummary[];
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

  // 搜尋字自己的條件（不含篩選），供「清除篩選後會有幾筆」的 count 重用。
  const searchConditions = [...conditions];
  const searchArgs = [...args];

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

  const countMatching = (conds: string[], a: (string | number)[]) =>
    (
      db
        .prepare(
          `SELECT COUNT(*) AS c FROM (SELECT id, name FROM magic ${conds.length > 0 ? `WHERE ${conds.join(" AND ")}` : ""} GROUP BY id, name)`,
        )
        .get(...a) as { c: number }
    ).c;

  const total = countMatching(conditions, args);

  // ponytail: 只有「有套篩選 + 篩完 0 筆」才會多跑這一次 count，
  // 有結果的正常路徑仍維持 count + list 兩句，不受影響。
  const filterActive = conditions.length > searchConditions.length;
  const unfilteredTotal =
    total === 0 && filterActive ? countMatching(searchConditions, searchArgs) : undefined;

  // extraTiebreak: magic table's unique key is (id, name), not id alone — see module note.
  const orderBy = buildOrderBy({
    allowlist: SKILL_SORT_ALLOWLIST,
    sortBy: params.sortBy,
    sortDir: params.sortDir,
    defaultOrderBy: "maxLevel DESC, id ASC, firstLevel ASC",
    idColumn: "id",
    extraTiebreak: "name ASC",
  });

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
    unfilteredTotal,
  };
}

// 舊介面：回某個 id 底下的全部 row，不管有沒有跨多個 name。詳情頁只用它當 fallback。
export function getSkillById(id: number): Magic[] {
  const db = getDb();
  return db.prepare(`SELECT * FROM magic WHERE id = ? ORDER BY level ASC`).all(id) as Magic[];
}

/**
 * 全部 distinct 的 magic.id（sitemap 用）。/skills/[id] 只認 id（level 為可選消歧義參數），
 * 只要 id 在 magic 表出現過，resolveAnchor() 就能 fallback 到第一筆，不會 404。
 */
export function getAllSkillIds(): number[] {
  const db = getDb();
  return (db.prepare(`SELECT DISTINCT id FROM magic`).all() as { id: number }[]).map((r) => r.id);
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

// 迷宮攻略怪物技能：skill_code = magic.id*100 + level（見 npc.skill1..4）。約 1.3%
// 的代碼是孤兒參照（magic 表沒有對應 (id,level) 列，遊戲端資料本身如此），呼叫端
// 用「查無就跳過」處理，不視為錯誤。抓「約N倍攻擊力」的倍率供表格顯示，抓不到時
// 為 null（許多技能的 help 文字沒有這個描述，例如純輔助技能）。
const MULTIPLIER_RE = /約([\d.]+)倍攻擊力/;

// target 分類：見 guide-steps.ts 的 StepSkillKind 說明。
// 近戰／遠程的分界取 range<=2（DB 實測敵方技能 range 幾乎都落在 1~3 或 6~10 兩群，
// 中位數 2 是常見的近戰上限，見 tthol_data 對 hit_range 的抽樣）。
function classifySkillKind(target: string | null, range: number | null): StepSkillKind {
  if (target === "TARGET_SELF") return "self";
  if (target === "TARGET_GROUP" || target === "TARGET_ALLY") return "group-buff";
  if (target === "TARGET_ENEMYTARGET" || target === "TARGET_ENEMY" || target === "TARGET_ENEMYEX") {
    if (range == null) return "other";
    return range <= 2 ? "melee" : "ranged";
  }
  return "other";
}

/**
 * 一批 skill_code（= magic.id*100 + level）解出的技能清單，用一次 `(id,level) IN (VALUES…)`
 * 查完 magic，再批次查 status 補 extraStatus 名稱（同一個 extra_status 可能被多個技能共用，
 * 用 Map 去重只查一次）。查無對應 magic 列的代碼（孤兒參照）直接跳過，不拋錯。
 * 呼叫端（getNpcCombatStats）負責把結果依 npc 分組、依 skill1..4 原始順序排列、去重。
 */
export function getSkillsByCodesBatch(codes: readonly number[]): Map<number, StepSkill> {
  const result = new Map<number, StepSkill>();
  const uniqueCodes = [...new Set(codes)];
  if (uniqueCodes.length === 0) return result;

  const db = getDb();
  const decoded = uniqueCodes.map((code) => ({
    code,
    magicId: Math.floor(code / 100),
    level: code % 100,
  }));
  const placeholders = decoded.map(() => "(?,?)").join(",");
  const args: number[] = [];
  for (const d of decoded) args.push(d.magicId, d.level);

  const rows = db
    .prepare(
      `SELECT id, level, name, target, range, help, extra_status, time
       FROM magic
       WHERE (id, level) IN (VALUES ${placeholders})`,
    )
    .all(...args) as Array<{
    id: number;
    level: number;
    name: string;
    target: string | null;
    range: number | null;
    help: string | null;
    extra_status: number | null;
    time: number | null;
  }>;

  const byKey = new Map(rows.map((r) => [`${r.id}:${r.level}`, r]));

  // extra_status 批次查一次，避免每個技能各自打一次 status 表。
  const statusIds = [...new Set(rows.map((r) => r.extra_status).filter((s): s is number => s != null))];
  const statusNameById = new Map<number, string | null>();
  for (const sid of statusIds) statusNameById.set(sid, getStatusById(sid)?.name ?? null);

  for (const d of decoded) {
    const row = byKey.get(`${d.magicId}:${d.level}`);
    if (!row) continue; // 孤兒參照：magic 沒有這一列，跳過
    const multiplierMatch = row.help?.match(MULTIPLIER_RE);
    result.set(d.code, {
      magicId: row.id,
      level: row.level,
      name: row.name,
      target: row.target,
      range: row.range,
      kind: classifySkillKind(row.target, row.range),
      multiplier: multiplierMatch ? Number(multiplierMatch[1]) : null,
      help: row.help,
      extraStatus: row.extra_status != null ? (statusNameById.get(row.extra_status) ?? null) : null,
      time: row.time,
    });
  }
  return result;
}
