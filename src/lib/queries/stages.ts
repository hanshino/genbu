import { getDb } from "@/lib/db";
import { parseStageFlags } from "@/lib/constants/stage-flags";
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
      `SELECT [group]   AS groupId,
              COUNT(*)  AS count,
              GROUP_CONCAT(name, '、') AS preview
       FROM (
         SELECT [group], name
         FROM stages
         WHERE name IS NOT NULL AND [group] IS NOT NULL
         ORDER BY [group], id
       )
       GROUP BY groupId
       ORDER BY groupId`,
    )
    .all() as Array<{ groupId: number; count: number; preview: string }>;
  return rows.map((r) => ({
    groupId: r.groupId,
    count: r.count,
    preview: trimPreview(r.preview),
  }));
}

function trimPreview(raw: string | null): string {
  if (!raw) return "";
  const parts = raw.split("、");
  if (parts.length <= 4) return parts.join("、");
  return `${parts.slice(0, 4).join("、")}…`;
}

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
  }));
}

/** 取得單一地圖的完整資訊（含群組鄰居 / 入向連結 / 任務）。 */
export function getStageDetail(id: number): StageDetail | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM stages WHERE id = ?")
    .get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  const stage = asRow(row);

  // 同群組鄰居（不含自己）
  const siblings: { id: number; name: string }[] =
    stage.group != null
      ? (db
          .prepare(
            `SELECT id, name FROM stages
             WHERE [group] = ? AND id <> ? AND name IS NOT NULL
             ORDER BY id`,
          )
          .all(stage.group, stage.id) as Array<{ id: number; name: string }>)
      : [];

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
