import type { EntityImage } from "@/lib/queries/images";
import type { StageKind } from "./stage";

export interface NpcSummary {
  id: number;
  name: string;
  memberIds: number[];
  mapCount: number;
  mapNames: string[];
  image: EntityImage | null;
}

export interface NpcPlacementRef {
  placementId: number;
  npcId: number;
}

export interface NpcMap {
  stageKind: StageKind;
  stageId: number;
  stageName: string | null;
  placements: NpcPlacementRef[];
}

export interface NpcMission {
  missionId: number;
  missionName: string | null;
  association: "member" | "name";
  eventTypes: string[];
}

export interface NpcDetail {
  id: number;
  name: string;
  memberIds: number[];
  maps: NpcMap[];
  image: EntityImage | null;
  missions: NpcMission[];
}
