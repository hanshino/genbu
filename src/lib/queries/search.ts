import { ITEM_TYPE_LABELS } from "@/lib/constants/item-types";
import { getDb } from "@/lib/db";
import { getGuide, getGuides } from "@/lib/guides";
import { NPC_MAPS_SQL } from "@/lib/queries/npcs";
import { getSearchablePages } from "@/lib/site-nav";
import {
  SEARCH_TYPES,
  SEARCH_TYPE_LABELS,
  type SearchGroup,
  type SearchHit,
  type SearchResult,
  type SearchType,
} from "@/lib/search-types";

const MAX_QUERY_LENGTH = 50;
const DEFAULT_PER_TYPE = 5;
const DEFAULT_PER_TYPE_SINGLE = 200;

export interface SearchOptions {
  perType?: number;
  type?: SearchType;
}

// 排名：0 = 完全相同、1 = 開頭相同、2 = 包含、3 = 只有說明文字包含。數字越小越前面。
const RANK_CONTAINS = 2;
const RANK_TEXT = 3;
const SNIPPET_RADIUS = 16;
// 關鍵字（同義詞）命中比名稱同級再差半級，讓名稱命中永遠贏過關鍵字命中。
const KEYWORD_PENALTY = 0.5;

/** LIKE 的萬用字元（%、_）與跳脫字元本身要跳脫，使用者輸入視為純文字。 */
function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, "\\$&");
}

function textRank(text: string, q: string): number | null {
  const t = text.toLowerCase();
  const needle = q.toLowerCase();
  if (t === needle) return 0;
  if (t.startsWith(needle)) return 1;
  if (t.includes(needle)) return RANK_CONTAINS;
  return null;
}

/** 說明文字去掉標籤與換行後，擷取命中處前後一小段，讓人看得出為什麼會搜到。 */
export function snippetAround(text: string, q: string): string {
  const plain = text
    .replace(/<[^>]*>/g, "")
    // 任務步驟裡的道具佔位符，例如 [item26069×5]
    .replace(/\[item\d+(?:×\d+)?\]/g, "")
    .replace(/(?:\\n|\s)+/g, " ")
    .trim();
  const at = plain.toLowerCase().indexOf(q.toLowerCase());
  if (at < 0) return plain.slice(0, SNIPPET_RADIUS * 2);
  const start = Math.max(0, at - SNIPPET_RADIUS);
  const end = Math.min(plain.length, at + q.length + SNIPPET_RADIUS);
  return `${start > 0 ? "…" : ""}${plain.slice(start, end)}${end < plain.length ? "…" : ""}`;
}

interface Ranked {
  rank: number;
  hit: SearchHit;
}

// ---- 資料庫類型 ----

// base 一律回傳 id, name, kname（排名／比對用的名稱）, meta；
// 各類型的 base 與對應列表頁的基準篩選一致，避免搜尋結果點進去 404。
interface DbSpec {
  type: SearchType;
  base: string;
  /** 數字查詢是否也比對 id（與列表頁的搜尋行為一致） */
  numericId?: boolean;
  /** base 另外回傳 ktext（說明文字），名稱沒中時也比對它 */
  fullText?: boolean;
  href: (row: DbRow) => string;
  hitId?: (row: DbRow) => string;
}

interface DbRow {
  id: number;
  name: string;
  meta: string | null;
  extra: number | null;
  ktext?: string | null;
  rank: number;
}

const DB_SPECS: DbSpec[] = [
  {
    type: "item",
    base: `SELECT id, name, name AS kname, type_name AS meta, NULL AS extra, summary AS ktext FROM items`,
    numericId: true,
    fullText: true,
    href: (r) => `/items/${r.id}`,
  },
  {
    // magic 沒有 PK，id 會跨技能共用，所以以 (id, name) 為一筆，連到該技能的最低等級；
    // 各等級說明不同，串起來比對，任一等級提到就算命中
    type: "skill",
    base: `SELECT id, name, name AS kname, clan AS meta, MIN(level) AS extra,
                  group_concat(help, ' ') AS ktext
           FROM magic GROUP BY id, name`,
    numericId: true,
    fullText: true,
    href: (r) => `/skills/${r.id}?level=${r.extra ?? 1}`,
    hitId: (r) => `${r.id}:${r.name}`,
  },
  {
    // 怪物名稱常以 ▲／● 開頭，排名時去掉，顯示仍用原名
    type: "monster",
    base: `SELECT n.id, n.name, ltrim(n.name, '▲●') AS kname,
                  'Lv.' || n.level AS meta, NULL AS extra
           FROM npc n WHERE n.type > 0`,
    numericId: true,
    href: (r) => `/monsters/${r.id}`,
  },
  {
    // 與 npcs.ts 同樣以名稱分組，連到組內最小 id
    type: "npc",
    base: `SELECT MIN(id) AS id, name, name AS kname,
                  COALESCE(
                    CASE WHEN COUNT(DISTINCT stageKind || ':' || stageId) = 1 THEN MAX(stageName) END,
                    COUNT(DISTINCT stageKind || ':' || stageId) || ' 張地圖'
                  ) AS meta,
                  NULL AS extra
           FROM (${NPC_MAPS_SQL}) GROUP BY name`,
    href: (r) => `/npcs/${r.id}`,
  },
  {
    // 任務說明加上各步驟文字，詳情頁都看得到
    type: "mission",
    base: `SELECT m.id, m.name, m.name AS kname, NULL AS meta, NULL AS extra,
                  COALESCE(m.help, '') || ' ' || COALESCE(
                    (SELECT group_concat(s.plain_text, ' ') FROM mission_steps s WHERE s.mission_id = m.id),
                    '') AS ktext
           FROM missions m WHERE m.name IS NOT NULL AND trim(m.name) <> ''`,
    fullText: true,
    href: (r) => `/missions/${r.id}`,
  },
  {
    // stages.id 在具名地圖間唯一（stage / sestage 的 id 互斥），詳情頁也只用 id 查
    type: "map",
    base: `SELECT id, name, name AS kname, NULL AS meta, NULL AS extra
           FROM stages WHERE name IS NOT NULL`,
    href: (r) => `/maps/${r.id}`,
  },
  {
    type: "hero",
    base: `SELECT id, name, name AS kname, NULL AS meta, NULL AS extra, help AS ktext FROM hero`,
    fullText: true,
    href: (r) => `/heroes/${r.id}`,
  },
  {
    type: "compound",
    base: `SELECT id, name, name AS kname, NULL AS meta, NULL AS extra FROM compound_groups`,
    href: (r) => `/compounds/${r.id}`,
  },
  {
    // 成就沒有詳情頁，導到列表頁的搜尋（列表頁同樣會比對描述）
    type: "achievement",
    base: `SELECT a.id, a.name, a.name AS kname, c.name AS meta, NULL AS extra,
                  a.description AS ktext
           FROM achievements a
           JOIN achievement_sub_cats sc ON sc.id = a.sub_cat_id
           JOIN achievement_categories c ON c.id = sc.category_id`,
    fullText: true,
    href: (r) => `/achievements?search=${encodeURIComponent(r.name)}`,
  },
];

function searchDbType(
  spec: DbSpec,
  q: string,
  limit: number,
): { total: number; hits: Ranked[] } {
  const db = getDb();
  const escaped = escapeLike(q);
  const numeric = spec.numericId && /^\d+$/.test(q) ? Number(q) : null;
  const where = [
    `kname LIKE @contains ESCAPE '\\'`,
    ...(spec.fullText ? [`ktext LIKE @contains ESCAPE '\\'`] : []),
    ...(numeric !== null ? ["id = @num"] : []),
  ].join(" OR ");
  const params: Record<string, string | number> = {
    contains: `%${escaped}%`,
    prefix: `${escaped}%`,
    q,
  };
  if (numeric !== null) params.num = numeric;

  const total = (
    db
      .prepare(`WITH base AS (${spec.base}) SELECT COUNT(*) AS c FROM base WHERE ${where}`)
      .get(params) as { c: number }
  ).c;
  if (total === 0) return { total, hits: [] };

  const rows = db
    .prepare(
      `WITH base AS (${spec.base})
       SELECT id, name, meta, extra,${spec.fullText ? " ktext," : ""}
              CASE ${numeric !== null ? "WHEN id = @num THEN 0" : ""}
                   WHEN kname = @q THEN 0
                   WHEN kname LIKE @prefix ESCAPE '\\' THEN 1
                   WHEN kname LIKE @contains ESCAPE '\\' THEN ${RANK_CONTAINS}
                   ELSE ${RANK_TEXT} END AS rank
       FROM base
       WHERE ${where}
       ORDER BY rank, length(kname), id
       LIMIT @limit`,
    )
    .all({ ...params, limit }) as DbRow[];

  return {
    total,
    hits: rows.map((r) => ({
      rank: r.rank,
      hit: {
        type: spec.type,
        id: spec.hitId ? spec.hitId(r) : String(r.id),
        name: r.name,
        href: spec.href(r),
        ...(r.meta ? { meta: spec.type === "item" ? (ITEM_TYPE_LABELS[r.meta] ?? r.meta) : r.meta } : {}),
        ...(r.rank === RANK_TEXT && r.ktext ? { snippet: snippetAround(r.ktext, q) } : {}),
      },
    })),
  };
}

// ---- 靜態資料類型（頁面、攻略）----

function searchPages(q: string): Ranked[] {
  const ranked: Ranked[] = [];
  for (const page of getSearchablePages()) {
    const nameRank = Math.min(
      textRank(page.label, q) ?? Infinity,
      page.title ? (textRank(page.title, q) ?? Infinity) : Infinity,
    );
    const keywordRank = Math.min(
      ...(page.keywords ?? []).map((k) => textRank(k, q) ?? Infinity),
      Infinity,
    );
    const rank = Math.min(nameRank, keywordRank + KEYWORD_PENALTY);
    if (!Number.isFinite(rank)) continue;
    ranked.push({
      rank,
      hit: { type: "page", id: page.href, name: page.label, href: page.href, meta: page.section },
    });
  }
  return ranked;
}

// 攻略內文去掉 MDX 語法後的純文字，依 slug 快取（內容隨 build 固定）
const guideTextCache = new Map<string, string>();

function guideText(slug: string): string {
  let text = guideTextCache.get(slug);
  if (text === undefined) {
    text = (getGuide(slug)?.source ?? "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/[#*_`>|]+/g, " ")
      .replace(/\s+/g, " ");
    guideTextCache.set(slug, text);
  }
  return text;
}

function searchGuides(q: string): Ranked[] {
  const ranked: Ranked[] = [];
  for (const g of getGuides()) {
    const titleRank = textRank(g.title, q);
    const body = titleRank === null ? guideText(g.slug) : "";
    const inBody = titleRank === null && body.toLowerCase().includes(q.toLowerCase());
    if (titleRank === null && !inBody) continue;
    const rank = titleRank ?? RANK_TEXT;
    const meta =
      g.levelMin !== null && g.levelMax !== null
        ? `Lv.${g.levelMin}~${g.levelMax}`
        : g.levelMin !== null
          ? `Lv.${g.levelMin}+`
          : undefined;
    ranked.push({
      rank,
      hit: {
        type: "guide",
        id: g.slug,
        name: g.title,
        href: `/guides/${g.slug}`,
        ...(meta ? { meta } : {}),
        ...(inBody ? { snippet: snippetAround(body, q) } : {}),
      },
    });
  }
  return ranked;
}

function byRank(a: Ranked, b: Ranked): number {
  return a.rank - b.rank || a.hit.name.length - b.hit.name.length;
}

function searchStatic(type: "page" | "guide", q: string, limit: number) {
  // Array.prototype.sort 是穩定排序，同分維持來源順序
  const all = (type === "page" ? searchPages(q) : searchGuides(q)).sort(byRank);
  return { total: all.length, hits: all.slice(0, limit) };
}

/**
 * 全站搜尋：各類型各取前 perType 筆（名稱完全相同 → 開頭相同 → 包含），
 * 再依「組內最佳排名 → SEARCH_TYPES 順序」排列群組。
 */
export function searchAll(q: string, opts: SearchOptions = {}): SearchResult {
  const query = q.trim().slice(0, MAX_QUERY_LENGTH).trim();
  if (!query) return { query: "", total: 0, groups: [] };

  const perType = Math.max(
    1,
    Math.floor(opts.perType ?? (opts.type ? DEFAULT_PER_TYPE_SINGLE : DEFAULT_PER_TYPE)),
  );
  const types = opts.type ? [opts.type] : SEARCH_TYPES;

  const found: { group: SearchGroup; best: number }[] = [];
  for (const type of types) {
    const spec = DB_SPECS.find((s) => s.type === type);
    const { total, hits } =
      type === "page" || type === "guide"
        ? searchStatic(type, query, perType)
        : searchDbType(spec!, query, perType);
    if (total === 0) continue;
    found.push({
      best: hits[0].rank,
      group: { type, label: SEARCH_TYPE_LABELS[type], total, hits: hits.map((h) => h.hit) },
    });
  }

  found.sort(
    (a, b) =>
      a.best - b.best || SEARCH_TYPES.indexOf(a.group.type) - SEARCH_TYPES.indexOf(b.group.type),
  );
  const groups = found.map((f) => f.group);
  return { query, total: groups.reduce((sum, g) => sum + g.total, 0), groups };
}
