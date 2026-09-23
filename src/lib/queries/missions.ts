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

type MissionListRow = Omit<MissionListItem, "acceptNpcs" | "minLevel" | "factions" | "hasReward" | "timed"> & {
  acceptNpcs: string | null;
  minLevel: number | null;
  factions: string | null;
  hasReward: number;
  timed: number;
};

/**
 * 列表頁：一條 SQL，客戶端邏輯表都先 GROUP BY 成每任務一列再 LEFT JOIN（不做 N+1）。
 * 一律只看 is_gm = 0 AND is_mission = 1。
 */
export function getAllMissionListItems(): MissionListItem[] {
  const db = getDb();
  const rows = db
    .prepare(
      `WITH
       -- 同 v_mission_overview.accept_npcs，但多濾 is_mission = 1
       accept AS (
         SELECT mission_id, group_concat(name, '、') AS npcs
         FROM (SELECT DISTINCT e.mission_id, s.name
               FROM mission_events e JOIN npc_strings s ON s.id = e.npc_name_id
               WHERE e.event = 'accept' AND e.is_gm = 0 AND e.is_mission = 1 AND s.name IS NOT NULL)
         GROUP BY mission_id
       ),
       -- 每個條件組 (file_no, msg_id, trigger_idx) 的等級下限。
       -- op=4 a0: 1 '<'、2 '>'、3 '<='、4 '>='；negated 反轉。上限類條件不算下限 → NULL。
       req_group AS (
         SELECT mission_id,
                MAX(CASE WHEN op = 4 THEN
                      CASE WHEN negated = 0 AND a0 = 4 THEN a1
                           WHEN negated = 0 AND a0 = 2 THEN a1 + 1
                           WHEN negated = 1 AND a0 = 1 THEN a1
                           WHEN negated = 1 AND a0 = 3 THEN a1 + 1
                      END
                    END) AS lv
         FROM mission_requirements
         WHERE is_gm = 0 AND is_mission = 1
         GROUP BY mission_id, file_no, msg_id, trigger_idx
       ),
       -- 各組是替代關係：任一組無等級下限 → 整個任務無等級需求
       req AS (
         SELECT mission_id, CASE WHEN COUNT(*) = COUNT(lv) THEN MIN(lv) END AS minLevel
         FROM req_group GROUP BY mission_id
       ),
       -- summary 形如「門派(0, 移花宮)」
       faction AS (
         SELECT mission_id, group_concat(name, '、') AS names
         FROM (SELECT DISTINCT mission_id,
                      substr(summary, instr(summary, ', ') + 2,
                             length(summary) - instr(summary, ', ') - 2) AS name
               FROM mission_requirements
               WHERE op = 2 AND negated = 0 AND is_gm = 0 AND is_mission = 1
                 AND summary LIKE '門派(%, %)')
         GROUP BY mission_id
       ),
       reward AS (
         SELECT DISTINCT mission_id FROM mission_rewards
         WHERE is_gm = 0 AND is_mission = 1
           AND reward_type NOT IN ('take_item', 'pay_gold', 'pay_charisma')
       ),
       timer AS (
         SELECT DISTINCT mission_id FROM mission_events
         WHERE is_gm = 0 AND is_mission = 1 AND event IN ('timer35', 'timer36') AND minutes > 0
       ),
       steps AS (
         SELECT mission_id, COUNT(*) AS n FROM mission_steps GROUP BY mission_id
       )
       SELECT m.id,
              m.name,
              m.group_id   AS groupId,
              m.cycle_time AS cycleTime,
              coalesce(steps.n, 0) AS stepCount,
              accept.npcs  AS acceptNpcs,
              req.minLevel AS minLevel,
              faction.names AS factions,
              reward.mission_id IS NOT NULL AS hasReward,
              timer.mission_id IS NOT NULL AS timed
       FROM missions m
       LEFT JOIN steps   ON steps.mission_id = m.id
       LEFT JOIN accept  ON accept.mission_id = m.id
       LEFT JOIN req     ON req.mission_id = m.id
       LEFT JOIN faction ON faction.mission_id = m.id
       LEFT JOIN reward  ON reward.mission_id = m.id
       LEFT JOIN timer   ON timer.mission_id = m.id
       ORDER BY (m.group_id IS NULL), m.group_id, m.id`,
    )
    .all() as MissionListRow[];
  // 空值欄位直接省略：多數任務沒有客戶端邏輯資料，省下 RSC payload 裡上千個重複 key
  return rows.map(({ acceptNpcs, minLevel, factions, hasReward, timed, ...base }) => {
    const item: MissionListItem = base;
    if (acceptNpcs) item.acceptNpcs = acceptNpcs.split("、");
    if (minLevel != null) item.minLevel = minLevel;
    if (factions) item.factions = factions.split("、");
    if (hasReward) item.hasReward = true;
    if (timed) item.timed = true;
    return item;
  });
}

/** 全部任務 id（sitemap 用的輕量查詢）。 */
export function getAllMissionIds(): number[] {
  const db = getDb();
  return (db.prepare(`SELECT id FROM missions`).all() as { id: number }[]).map((r) => r.id);
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

  // 名稱回查：item / npc / stage。npc_id=0 是「非具體 NPC」placeholder，不查。
  const itemIds = new Set<number>();
  const npcIds = new Set<number>();
  const mapIds = new Set<number>();
  for (const r of refRows) {
    if (r.ref_type === "item" && r.item_id != null) itemIds.add(r.item_id);
    if (r.ref_type === "map" && r.npc_id != null && r.npc_id > 0) npcIds.add(r.npc_id);
    if (r.ref_type === "map" && r.map_id != null && r.map_id !== 0) mapIds.add(r.map_id);
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
  const mapNames = new Map<number, string>();
  if (mapIds.size > 0) {
    const ph = Array.from({ length: mapIds.size }, () => "?").join(",");
    const stages = db
      .prepare(`SELECT id, name FROM stages WHERE id IN (${ph}) AND name IS NOT NULL`)
      .all(...mapIds) as Array<{ id: number; name: string }>;
    for (const s of stages) mapNames.set(s.id, s.name);
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
        mapName: mapNames.get(r.map_id) ?? null,
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
