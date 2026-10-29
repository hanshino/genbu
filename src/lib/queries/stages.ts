import { getDb } from "@/lib/db";
import { parseStageFlags } from "@/lib/constants/stage-flags";
import { isPlaceholderStageName } from "@/lib/placeholder-data";
import type {
  InboundLink,
  StageDetail,
  StageGroupStats,
  StageKind,
  StageListItem,
  StageMissionRef,
  StageRow,
} from "@/lib/types/stage";

/** Internal row → StageRow with widened typed fields. */
function asRow(r: Record<string, unknown>): StageRow {
  return r as unknown as StageRow;
}

/**
 * 名稱對照表：mission UI 用，把 mission_refs.map_id 一次性解析為地圖名稱。
 * stage / sestage id 互斥，因此 id → name 唯一。
 */
export function getAllStageNames(): Map<number, string> {
  const db = getDb();
  const rows = db
    .prepare("SELECT id, name FROM stages WHERE name IS NOT NULL")
    .all() as Array<{ id: number; name: string }>;
  return new Map(rows.map((r) => [r.id, r.name]));
}

/** 返回 hub 用的群組統計，過濾掉沒有任何具名地圖的群組。 */
export function getAllStageGroupStats(): StageGroupStats[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT [group] AS groupId, name
       FROM stages
       WHERE name IS NOT NULL AND [group] IS NOT NULL
       ORDER BY [group], id`,
    )
    .all() as Array<{ groupId: number; name: string }>;
  const byGroup = new Map<number, string[]>();
  for (const r of rows) {
    const names = byGroup.get(r.groupId) ?? [];
    names.push(r.name);
    byGroup.set(r.groupId, names);
  }
  return [...byGroup].map(([groupId, names]) => {
    // 去重、略過佔位地圖名（整組都是佔位時才用原名）
    const real = names.filter((n) => !isPlaceholderStageName(n));
    const unique = [...new Set(real.length > 0 ? real : names)];
    const label = GROUP_LABEL_OVERRIDES[groupId] ?? unique[0];
    const rest = unique.filter((n) => n !== label);
    return {
      groupId,
      count: names.length,
      label,
      preview: rest.length <= 3 ? rest.join("、") : `${rest.slice(0, 3).join("、")}…`,
    };
  });
}

// 第一張地圖代表不了整區的群組。區域 1 是寵物練功場、魔族巢穴、比武校場、秘境等雜項。
const GROUP_LABEL_OVERRIDES: Record<number, string> = { 1: "特殊場景" };

/** Hub 用的全量地圖清單。 */
export function getAllStageListItems(): StageListItem[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT s.id,
              s.kind,
              s.name,
              s.[group] AS groupId,
              s.flag,
              (
                SELECT COUNT(*) FROM stages t
                WHERE t.appear_map1 = s.id
                   OR t.appear_map2 = s.id
                   OR t.logout_map  = s.id
              ) AS inboundCount
       FROM stages s
       WHERE s.name IS NOT NULL
       ORDER BY (s.[group] IS NULL), s.[group], s.kind, s.id`,
    )
    .all() as Array<{
    id: number;
    kind: StageKind;
    name: string;
    groupId: number | null;
    flag: string | null;
    inboundCount: number;
  }>;
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    name: r.name,
    groupId: r.groupId,
    flags: parseStageFlags(r.flag),
    inboundCount: r.inboundCount,
    ...(isPlaceholderStageName(r.name) ? { placeholder: true } : {}),
  }));
}

/** 全部具名地圖 id（sitemap 用）。與 /maps/[id] 的 notFound() 條件一致：需要 name IS NOT NULL；另略過佔位地圖（這些頁面也會 noindex）。 */
export function getAllStageIds(): number[] {
  const db = getDb();
  return (
    db.prepare(`SELECT id, name FROM stages WHERE name IS NOT NULL`).all() as {
      id: number;
      name: string;
    }[]
  )
    .filter((r) => !isPlaceholderStageName(r.name))
    .map((r) => r.id);
}

/** 取得單一地圖的完整資訊（含群組鄰居 / 入向連結 / 任務）。 */
export function getStageDetail(id: number): StageDetail | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM stages WHERE id = ?")
    .get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  const stage = asRow(row);

  // 同群組鄰居（不含自己）。略過佔位地圖；同名的多層／多分流只留第一張，也不列跟自己同名的。
  const siblingRows: { id: number; name: string }[] =
    stage.group != null
      ? (db
          .prepare(
            `SELECT id, name FROM stages
             WHERE [group] = ? AND id <> ? AND name IS NOT NULL
             ORDER BY id`,
          )
          .all(stage.group, stage.id) as Array<{ id: number; name: string }>)
      : [];
  const seenNames = new Set<string>(stage.name ? [stage.name] : []);
  const siblings = siblingRows.filter(
    (s) => !isPlaceholderStageName(s.name) && !seenNames.has(s.name) && seenNames.add(s.name),
  );

  // 名稱解析（appear / logout 指向）
  const lookupIds = new Set<number>();
  for (const v of [stage.appear_map1, stage.appear_map2, stage.logout_map]) {
    if (v && v !== 0) lookupIds.add(v);
  }
  const nameLookup = new Map<number, string>();
  if (lookupIds.size > 0) {
    const ph = Array.from({ length: lookupIds.size }, () => "?").join(",");
    const rows = db
      .prepare(`SELECT id, name FROM stages WHERE id IN (${ph})`)
      .all(...lookupIds) as Array<{ id: number; name: string | null }>;
    for (const r of rows) {
      if (r.name) nameLookup.set(r.id, r.name);
    }
  }

  // 反向：哪些地圖把這裡列為 appear/logout 目的地（聚合多欄位）
  const inboundRows = db
    .prepare(
      `SELECT id, name, appear_map1, appear_map2, logout_map
       FROM stages
       WHERE name IS NOT NULL
         AND (appear_map1 = ? OR appear_map2 = ? OR logout_map = ?)
         AND id <> ?`,
    )
    .all(stage.id, stage.id, stage.id, stage.id) as Array<{
    id: number;
    name: string;
    appear_map1: number | null;
    appear_map2: number | null;
    logout_map: number | null;
  }>;
  const inbound: InboundLink[] = inboundRows.map((r) => {
    const via: InboundLink["via"] = [];
    if (r.appear_map1 === stage.id) via.push("appear_map1");
    if (r.appear_map2 === stage.id) via.push("appear_map2");
    if (r.logout_map === stage.id) via.push("logout_map");
    return { fromId: r.id, fromName: r.name, via };
  });

  const missions = getMissionsAtStage(stage.id);

  return {
    ...stage,
    flags: parseStageFlags(stage.flag),
    groupSiblings: siblings,
    appearMap1Name: stage.appear_map1 ? nameLookup.get(stage.appear_map1) ?? null : null,
    appearMap2Name: stage.appear_map2 ? nameLookup.get(stage.appear_map2) ?? null : null,
    logoutMapName: stage.logout_map ? nameLookup.get(stage.logout_map) ?? null : null,
    inbound,
    missions,
  };
}

/** 反查：哪些任務會指到這張地圖。 */
export function getMissionsAtStage(stageId: number): StageMissionRef[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT mr.mission_id   AS missionId,
              COUNT(*)        AS refCount,
              m.name          AS missionName,
              m.group_id      AS groupId
       FROM mission_refs mr
       JOIN missions m ON m.id = mr.mission_id
       WHERE mr.ref_type = 'map' AND mr.map_id = ?
       GROUP BY mr.mission_id, m.name, m.group_id
       ORDER BY (m.group_id IS NULL), m.group_id, mr.mission_id`,
    )
    .all(stageId) as StageMissionRef[];
  return rows;
}
