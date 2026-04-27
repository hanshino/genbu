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
