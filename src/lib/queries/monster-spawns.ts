import { getDb } from "@/lib/db";
import type { StageKind } from "@/lib/types/stage";
import type { MonsterStageSpawn, StageMonsterSpawn } from "@/lib/types/monster-spawn";

export function getStagesForMonster(npcId: number): MonsterStageSpawn[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT s.kind    AS stageKind,
              s.id      AS stageId,
              s.name    AS stageName,
              s.[group] AS groupId,
              COUNT(*)  AS spawnPoints
       FROM monster_spawns ms
       JOIN stages s ON s.kind = ms.stage_kind AND s.id = ms.stage_id
       WHERE ms.npc_id = ?
       GROUP BY s.kind, s.id
       ORDER BY spawnPoints DESC, s.id ASC`,
    )
    .all(npcId) as Array<{
    stageKind: StageKind;
    stageId: number;
    stageName: string | null;
    groupId: number | null;
    spawnPoints: number;
  }>;
  return rows;
}

// 批次版 getStagesForMonster：避免對掉落清單裡每隻怪各發一次查詢（N+1）。
export function getStagesForMonsters(
  npcIds: readonly number[],
): Map<number, MonsterStageSpawn[]> {
  const result = new Map<number, MonsterStageSpawn[]>();
  if (npcIds.length === 0) return result;

  const db = getDb();
  const placeholders = npcIds.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT ms.npc_id AS npcId,
              s.kind    AS stageKind,
              s.id      AS stageId,
              s.name    AS stageName,
              s.[group] AS groupId,
              COUNT(*)  AS spawnPoints
       FROM monster_spawns ms
       JOIN stages s ON s.kind = ms.stage_kind AND s.id = ms.stage_id
       WHERE ms.npc_id IN (${placeholders})
       GROUP BY ms.npc_id, s.kind, s.id
       ORDER BY ms.npc_id, spawnPoints DESC, s.id ASC`,
    )
    .all(...npcIds) as Array<{
    npcId: number;
    stageKind: StageKind;
    stageId: number;
    stageName: string | null;
    groupId: number | null;
    spawnPoints: number;
  }>;

  for (const { npcId, ...spawn } of rows) {
    const list = result.get(npcId);
    if (list) {
      list.push(spawn);
    } else {
      result.set(npcId, [spawn]);
    }
  }
  return result;
}

export function getMonstersAtStage(stageKind: StageKind, stageId: number): StageMonsterSpawn[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT n.id     AS npcId,
              n.name   AS name,
              n.level  AS level,
              n.hp     AS hp,
              COUNT(*) AS spawnPoints
       FROM monster_spawns ms
       JOIN npc n ON n.id = ms.npc_id
       WHERE ms.stage_kind = ? AND ms.stage_id = ?
       GROUP BY n.id
       ORDER BY n.level ASC, n.id ASC`,
    )
    .all(stageKind, stageId) as StageMonsterSpawn[];
  return rows;
}
