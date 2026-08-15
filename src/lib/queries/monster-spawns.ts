import { getDb } from "@/lib/db";
import { getNpcImageMap } from "@/lib/queries/images";
import { MAX_MONSTER_LEVEL, MIN_MONSTER_LEVEL } from "@/lib/constants/monster-level";
import type { StageKind } from "@/lib/types/stage";
import type {
  MonsterStageSpawn,
  StageMonsterSpawn,
  TrainingSpot,
  TrainingSpotMonster,
} from "@/lib/types/monster-spawn";

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
export function getStagesForMonsters(npcIds: readonly number[]): Map<number, MonsterStageSpawn[]> {
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

/** 適配窗口半徑：玩家等級 ±5，inclusive。這是本功能唯一的窗口來源。 */
export const TRAINING_LEVEL_RADIUS = 5;

/**
 * GET query string 的 trust boundary：只接受 1–200 的十進位整數。
 * 無效輸入一律回 null，不默默 clamp 成別的玩家等級。
 */
export function parseTrainingLevel(value: string | undefined): number | null {
  if (value === undefined) return null;
  // 只允許純數字：擋掉 ""、" "、"-1"、"+80"、"80.5"、"1e2"、"abc"、"NaN"。
  if (!/^\d+$/.test(value.trim())) return null;
  const level = Number(value.trim());
  if (!Number.isInteger(level)) return null;
  if (level < MIN_MONSTER_LEVEL || level > MAX_MONSTER_LEVEL) return null;
  return level;
}

interface TrainingSpotRow {
  stageKind: StageKind;
  stageId: number;
  stageName: string;
  groupId: number | null;
  minLevelRequire: number | null;
  monsterLevelMin: number;
  monsterLevelMax: number;
  suitableLevelMin: number;
  suitableLevelMax: number;
  monsterCount: number;
  suitableMonsterCount: number;
  spawnPoints: number;
  suitableSpawnPoints: number;
  unknownLevelSpawnPoints: number;
  fitPercent: number;
  averageLevelDistance: number;
}

// 練功對象判準：JOIN monsters（entity 邊界）+ drop_exp > 1（打了有經驗）。
// 不可改用 hp 或 type 閾值 —— 城鎮 NPC（例：sestage:1958 檀泉別苑）血量 134k–181k，
// 比真練功怪的約 10k 高一個數量級，任何 hp 閾值都會同時誤殺與漏放。
const TRAINING_TARGET_JOIN = `
  JOIN stages s ON s.kind = ms.stage_kind AND s.id = ms.stage_id
  JOIN npc n ON n.id = ms.npc_id
  JOIN monsters m ON m.id = n.id
  WHERE s.name IS NOT NULL AND m.drop_exp > 1`;

/**
 * 玩家等級 → 候選練功地圖。
 *
 * 固定 3 個 query，不得逐 stage 或逐怪物查詢：
 *   1. aggregate 出地圖列（等級分布、刷怪點、集中度）
 *   2. batch 取所有候選 stage 的適配怪物
 *   3. getNpcImageMap() 一次補立繪
 */
export function getTrainingSpots(playerLevel: number): TrainingSpot[] {
  if (
    !Number.isInteger(playerLevel) ||
    playerLevel < MIN_MONSTER_LEVEL ||
    playerLevel > MAX_MONSTER_LEVEL
  ) {
    return [];
  }

  const levelMin = Math.max(MIN_MONSTER_LEVEL, playerLevel - TRAINING_LEVEL_RADIUS);
  const levelMax = Math.min(MAX_MONSTER_LEVEL, playerLevel + TRAINING_LEVEL_RADIUS);
  const db = getDb();

  // Query 1：單一 aggregate。level 不在 1–200 的 row 不進 min/max、不進適配、
  // 不進 spawnPoints 分母，只計入 unknownLevelSpawnPoints（不用 COALESCE 當成 Lv 0）。
  const rows = db
    .prepare(
      `SELECT s.kind    AS stageKind,
              s.id      AS stageId,
              s.name    AS stageName,
              s.[group] AS groupId,
              s.min_level_require AS minLevelRequire,

              MIN(CASE WHEN n.level BETWEEN @validMin AND @validMax THEN n.level END)
                AS monsterLevelMin,
              MAX(CASE WHEN n.level BETWEEN @validMin AND @validMax THEN n.level END)
                AS monsterLevelMax,
              MIN(CASE WHEN n.level BETWEEN @levelMin AND @levelMax THEN n.level END)
                AS suitableLevelMin,
              MAX(CASE WHEN n.level BETWEEN @levelMin AND @levelMax THEN n.level END)
                AS suitableLevelMax,

              COUNT(DISTINCT CASE WHEN n.level BETWEEN @validMin AND @validMax THEN n.id END)
                AS monsterCount,
              COUNT(DISTINCT CASE WHEN n.level BETWEEN @levelMin AND @levelMax THEN n.id END)
                AS suitableMonsterCount,

              SUM(CASE WHEN n.level BETWEEN @validMin AND @validMax THEN 1 ELSE 0 END)
                AS spawnPoints,
              SUM(CASE WHEN n.level BETWEEN @levelMin AND @levelMax THEN 1 ELSE 0 END)
                AS suitableSpawnPoints,
              SUM(CASE WHEN n.level IS NULL OR n.level < @validMin OR n.level > @validMax
                       THEN 1 ELSE 0 END)
                AS unknownLevelSpawnPoints,

              100.0 * SUM(CASE WHEN n.level BETWEEN @levelMin AND @levelMax THEN 1 ELSE 0 END)
                / NULLIF(
                    SUM(CASE WHEN n.level BETWEEN @validMin AND @validMax THEN 1 ELSE 0 END),
                    0
                  ) AS fitPercent,
              AVG(CASE WHEN n.level BETWEEN @validMin AND @validMax
                       THEN ABS(n.level - @playerLevel) END)
                AS averageLevelDistance
       FROM monster_spawns ms${TRAINING_TARGET_JOIN}
       GROUP BY s.kind, s.id, s.name, s.[group], s.min_level_require
       HAVING SUM(CASE WHEN n.level BETWEEN @levelMin AND @levelMax THEN 1 ELSE 0 END) > 0
       ORDER BY fitPercent DESC,
                suitableSpawnPoints DESC,
                averageLevelDistance ASC,
                s.kind ASC,
                s.id ASC`,
    )
    .all({
      validMin: MIN_MONSTER_LEVEL,
      validMax: MAX_MONSTER_LEVEL,
      levelMin,
      levelMax,
      playerLevel,
    }) as TrainingSpotRow[];

  if (rows.length === 0) return [];

  // Query 2：一次取回所有候選 stage 的適配怪物。候選數上限是 stages 總數（718），
  // 加上 2 個 level 參數仍遠低於 SQLite 999 變數上限，因此不需分塊。
  const stageIdsByKind = new Map<StageKind, number[]>();
  for (const row of rows) {
    const list = stageIdsByKind.get(row.stageKind);
    if (list) list.push(row.stageId);
    else stageIdsByKind.set(row.stageKind, [row.stageId]);
  }
  const kindClauses: string[] = [];
  const stageParams: (string | number)[] = [];
  for (const [kind, ids] of stageIdsByKind) {
    kindClauses.push(`(ms.stage_kind = ? AND ms.stage_id IN (${ids.map(() => "?").join(",")}))`);
    stageParams.push(kind, ...ids);
  }

  const monsterRows = db
    .prepare(
      `SELECT ms.stage_kind AS stageKind,
              ms.stage_id   AS stageId,
              n.id          AS npcId,
              n.name        AS name,
              n.level       AS level
       FROM monster_spawns ms${TRAINING_TARGET_JOIN}
         AND n.level BETWEEN ? AND ?
         AND (${kindClauses.join(" OR ")})
       GROUP BY ms.stage_kind, ms.stage_id, n.id
       ORDER BY ms.stage_kind, ms.stage_id, n.level ASC, n.id ASC`,
    )
    .all(levelMin, levelMax, ...stageParams) as Array<{
    stageKind: StageKind;
    stageId: number;
    npcId: number;
    name: string | null;
    level: number;
  }>;

  // Query 3：batch 立繪（getNpcImageMap 內部已分塊）。約 5% 怪物查無，image 為 null。
  const imageMap = getNpcImageMap(monsterRows.map((r) => r.npcId));

  const monstersByStage = new Map<string, TrainingSpotMonster[]>();
  for (const r of monsterRows) {
    const key = `${r.stageKind}:${r.stageId}`;
    const monster: TrainingSpotMonster = {
      npcId: r.npcId,
      name: r.name ?? "",
      level: r.level,
      image: imageMap.get(r.npcId) ?? null,
    };
    const list = monstersByStage.get(key);
    if (list) list.push(monster);
    else monstersByStage.set(key, [monster]);
  }

  return rows.map((row) => ({
    ...row,
    suitableMonsters: monstersByStage.get(`${row.stageKind}:${row.stageId}`) ?? [],
  }));
}
