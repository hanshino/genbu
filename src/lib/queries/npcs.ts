import { getDb } from "@/lib/db";
import { getNpcImageMap } from "@/lib/queries/images";
import type { NpcDetail, NpcMap, NpcMission, NpcSummary } from "@/lib/types/npc";

const NPC_MAPS_SQL = `
  SELECT n.id, n.name, p.id AS placementId,
                  p.stage_kind AS stageKind,
                  p.stage_id AS stageId,
                  s.name AS stageName
  FROM npc n
  JOIN map_placements p ON p.npc_id = n.id
  LEFT JOIN stages s ON s.kind = p.stage_kind AND s.id = p.stage_id
  WHERE n.is_npc = 1 AND n.is_monster = 0
    AND n.name IS NOT NULL AND trim(n.name) <> ''
    AND p.category = 'npc' AND p.in_bounds = 1`;

function getNpcGroups(condition: string, value: string | number): Omit<NpcDetail, "missions">[] {
  const rows = getDb()
    .prepare(
      `WITH npc_maps AS (${NPC_MAPS_SQL})
       SELECT * FROM npc_maps WHERE ${condition}
       ORDER BY name, stageKind, stageId, placementId`,
    )
    .all(value) as Array<Omit<NpcMap, "placements"> & { id: number; name: string; placementId: number }>;

  const groups = new Map<string, { memberIds: Set<number>; maps: NpcMap[] }>();
  for (const { id, name, stageKind, stageId, stageName, placementId } of rows) {
    let group = groups.get(name);
    if (!group) {
      group = { memberIds: new Set(), maps: [] };
      groups.set(name, group);
    }
    group.memberIds.add(id);
    const previousMap = group.maps.at(-1);
    if (previousMap?.stageKind !== stageKind || previousMap.stageId !== stageId) {
      group.maps.push({ stageKind, stageId, stageName, placements: [] });
    }
    group.maps.at(-1)!.placements.push({ placementId, npcId: id });
  }

  const images = getNpcImageMap([...groups.values()].flatMap((group) => [...group.memberIds]));
  return [...groups].map(([name, group]) => {
    const memberIds = [...group.memberIds].sort((a, b) => a - b);
    const imageId = memberIds.find((id) => images.has(id));
    return {
      id: memberIds[0],
      name,
      memberIds,
      maps: group.maps,
      image: imageId === undefined ? null : images.get(imageId)!,
    };
  });
}

export function searchNpcs(q: string): NpcSummary[] {
  return getNpcGroups("name LIKE ?", `%${q.trim()}%`).map(({ maps, ...npc }) => ({
    ...npc,
    mapCount: maps.length,
    mapNames: [...new Set(maps.flatMap((map) => (map.stageName === null ? [] : [map.stageName])))],
  }));
}

export function getNpcDetail(id: number): NpcDetail | null {
  const npc = getNpcGroups("name = (SELECT name FROM npc_maps WHERE id = ? LIMIT 1)", id)[0];
  if (!npc) return null;

  const rows = getDb()
    .prepare(
      `WITH associations AS (
         SELECT m.id AS missionId, m.name AS missionName, 'member' AS association,
                NULL AS eventType
         FROM mission_refs r JOIN missions m ON m.id = r.mission_id
         WHERE r.npc_id > 0 AND r.npc_id IN (SELECT value FROM json_each(@memberIds))
         UNION
         SELECT m.id, m.name, 'name', e.event
         FROM mission_events e
         JOIN npc_strings s ON s.id = e.npc_name_id
         JOIN missions m ON m.id = e.mission_id
         WHERE s.name = @name
       )
       SELECT missionId, missionName,
              CASE WHEN MAX(association = 'member') THEN 'member' ELSE 'name' END AS association,
              json_group_array(DISTINCT eventType)
                FILTER (WHERE eventType IS NOT NULL) AS eventTypes
       FROM (SELECT * FROM associations ORDER BY missionId, eventType)
       GROUP BY missionId
       ORDER BY missionId`,
    )
    .all({ memberIds: JSON.stringify(npc.memberIds), name: npc.name }) as Array<
    Omit<NpcMission, "eventTypes"> & { eventTypes: string }
  >;
  const missions = rows.map((row) => ({ ...row, eventTypes: JSON.parse(row.eventTypes) as string[] }));
  return { ...npc, missions };
}
