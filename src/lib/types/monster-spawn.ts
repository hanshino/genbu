import type { EntityImage } from "@/lib/queries/images";
import type { StageKind } from "./stage";

export interface MonsterStageSpawn {
  stageKind: StageKind;
  stageId: number;
  stageName: string | null;
  groupId: number | null;
  spawnPoints: number;
}

export interface StageMonsterSpawn {
  npcId: number;
  name: string;
  level: number;
  hp: number | null;
  spawnPoints: number;
}

/**
 * 練功地圖候選：以玩家等級反查 monster_spawns 聚合出的一張地圖。
 *
 * 「練功對象」判準為 `JOIN monsters m ON m.id = npc.id AND m.drop_exp > 1`；
 * 不使用 hp 或 type 閾值（城鎮 NPC 血量可高於真練功怪一個數量級）。
 * 所有 count 都只計入 npc.level 落在 1–200 的 spawn rows。
 */
export interface TrainingSpot {
  stageKind: StageKind;
  stageId: number;
  stageName: string;
  groupId: number | null;

  /** `stages.min_level_require` 原樣回傳；不參與適配與排序。 */
  minLevelRequire: number | null;

  /** 有效練功對象 spawn rows 的 MIN/MAX(npc.level)。 */
  monsterLevelMin: number;
  monsterLevelMax: number;
  /** 只看落在玩家窗口內的 MIN/MAX(npc.level)。 */
  suitableLevelMin: number;
  suitableLevelMax: number;

  /** distinct NPC 數（重複 spawn rows 只算一種）。 */
  monsterCount: number;
  suitableMonsterCount: number;

  /** monster_spawns row 數（重複 rows 每筆都算一個刷怪點）。 */
  spawnPoints: number;
  suitableSpawnPoints: number;
  /** 通過練功對象判準但 npc.level 不在 1–200 的 row 數；不計入 spawnPoints。 */
  unknownLevelSpawnPoints: number;

  /** suitableSpawnPoints / spawnPoints * 100，只描述「刷怪點等級集中度」。 */
  fitPercent: number;
  /** spawn-row weighted AVG(ABS(npc.level - playerLevel))，只作 tie-break。 */
  averageLevelDistance: number;

  /** 適配窗口內的怪物預覽，供卡片立繪帶使用；依 level 遞增、id 遞增排序。 */
  suitableMonsters: TrainingSpotMonster[];
}

export interface TrainingSpotMonster {
  npcId: number;
  name: string;
  level: number;
  /** 來自 npc_images；約 5% 怪物查無，UI 需有 fallback。 */
  image: EntityImage | null;
}
