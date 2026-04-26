import { getDb } from "@/lib/db";
import type {
  MissionDetail,
  MissionGroupStats,
  MissionItemRef,
  MissionListItem,
  MissionMapRef,
  MissionRefRow,
  MissionRow,
  MissionStep,
  MissionStepRow,
  MissionUseOfItem,
} from "@/lib/types/mission";

export function getAllMissionGroupStats(): MissionGroupStats[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT group_id   AS groupId,
              COUNT(*)   AS count,
              SUM(CASE WHEN cycle_time IS NOT NULL THEN 1 ELSE 0 END) AS cycleCount
       FROM missions
       GROUP BY group_id
       ORDER BY (group_id IS NULL), group_id`,
    )
    .all() as MissionGroupStats[];
  return rows;
}

export function getAllMissionListItems(): MissionListItem[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT m.id,
              m.name,
              m.group_id   AS groupId,
              m.cycle_time AS cycleTime,
              (SELECT COUNT(*) FROM mission_steps s WHERE s.mission_id = m.id) AS stepCount
       FROM missions m
       ORDER BY (m.group_id IS NULL), m.group_id, m.id`,
    )
    .all() as MissionListItem[];
  return rows;
}

export function getMissionDetail(id: number): MissionDetail | null {
  const db = getDb();
  const row = db
    .prepare(`SELECT * FROM missions WHERE id = ?`)
    .get(id) as MissionRow | undefined;
  if (!row) return null;

  const stepRows = db
    .prepare(
      `SELECT * FROM mission_steps WHERE mission_id = ? ORDER BY step_index`,
    )
    .all(id) as MissionStepRow[];
  const refRows = db
    .prepare(`SELECT * FROM mission_refs WHERE mission_id = ?`)
    .all(id) as MissionRefRow[];

  // 名稱回查：item / npc。npc_id=0 是「非具體 NPC」placeholder，不查。
  const itemIds = new Set<number>();
  const npcIds = new Set<number>();
  for (const r of refRows) {
    if (r.ref_type === "item" && r.item_id != null) itemIds.add(r.item_id);
    if (r.ref_type === "map" && r.npc_id != null && r.npc_id > 0) npcIds.add(r.npc_id);
  }

  const itemNames = new Map<number, string>();
  if (itemIds.size > 0) {
    const ph = Array.from({ length: itemIds.size }, () => "?").join(",");
    const items = db
      .prepare(`SELECT id, name FROM items WHERE id IN (${ph})`)
      .all(...itemIds) as Array<{ id: number; name: string }>;
    for (const it of items) itemNames.set(it.id, it.name);
  }
  const npcNames = new Map<number, string>();
  if (npcIds.size > 0) {
    const ph = Array.from({ length: npcIds.size }, () => "?").join(",");
    const npcs = db
      .prepare(`SELECT id, name FROM npc WHERE id IN (${ph})`)
      .all(...npcIds) as Array<{ id: number; name: string }>;
    for (const n of npcs) npcNames.set(n.id, n.name);
  }

  type Bucket = { items: MissionItemRef[]; maps: MissionMapRef[] };
  const refsByStep = new Map<number, Bucket>();
  const ensureBucket = (idx: number): Bucket => {
    let b = refsByStep.get(idx);
    if (!b) {
      b = { items: [], maps: [] };
      refsByStep.set(idx, b);
    }
    return b;
  };

  for (const r of refRows) {
    if (r.ref_type === "item" && r.item_id != null) {
      ensureBucket(r.step_index).items.push({
        itemId: r.item_id,
        qty: r.qty,
        name: itemNames.get(r.item_id) ?? `#${r.item_id}`,
      });
    } else if (r.ref_type === "map" && r.map_id != null) {
      const npcId = r.npc_id ?? 0;
      ensureBucket(r.step_index).maps.push({
        mapId: r.map_id,
        x: r.x,
        y: r.y,
        npcId,
        npcName: npcId > 0 ? npcNames.get(npcId) ?? null : null,
        label: r.label,
      });
    }
  }

  const helpBucket = refsByStep.get(0) ?? { items: [], maps: [] };
  const steps: MissionStep[] = stepRows.map((s) => {
    const b = refsByStep.get(s.step_index) ?? { items: [], maps: [] };
    return {
      index: s.step_index,
      rawText: s.raw_text,
      plainText: s.plain_text,
      items: b.items,
      maps: b.maps,
    };
  });

  // 全任務去重彙總
  const allItemsMap = new Map<number, MissionItemRef>();
  for (const list of [helpBucket.items, ...steps.map((s) => s.items)]) {
    for (const it of list) {
      const prev = allItemsMap.get(it.itemId);
      if (!prev) {
        allItemsMap.set(it.itemId, it);
      } else if (it.qty != null && (prev.qty ?? 0) < it.qty) {
        allItemsMap.set(it.itemId, it);
      }
    }
  }
  const allMapsMap = new Map<string, MissionMapRef>();
  for (const list of [helpBucket.maps, ...steps.map((s) => s.maps)]) {
    for (const mp of list) {
      const key = `${mp.mapId}:${mp.npcId}:${mp.label ?? ""}`;
      if (!allMapsMap.has(key)) allMapsMap.set(key, mp);
    }
  }

  return {
    id: row.id,
    name: row.name,
    groupId: row.group_id,
    cycleTime: row.cycle_time,
    hidMissionGroup: row.hid_mission_group,
    help: row.help,
    helpItems: helpBucket.items,
    helpMaps: helpBucket.maps,
    steps,
    allItems: [...allItemsMap.values()],
    allMaps: [...allMapsMap.values()],
  };
}

/** 反查：哪些任務需要這個物品？（item detail 頁用） */
export function getMissionsUsingItem(itemId: number): MissionUseOfItem[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT mr.mission_id   AS missionId,
              MAX(mr.qty)      AS qty,
              m.name           AS missionName,
              m.group_id       AS groupId,
              m.cycle_time     AS cycleTime
       FROM mission_refs mr
       JOIN missions m ON m.id = mr.mission_id
       WHERE mr.ref_type = 'item' AND mr.item_id = ?
       GROUP BY mr.mission_id, m.name, m.group_id, m.cycle_time
       ORDER BY (m.group_id IS NULL), m.group_id, mr.mission_id`,
    )
    .all(itemId) as MissionUseOfItem[];
  return rows;
}
