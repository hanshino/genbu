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
