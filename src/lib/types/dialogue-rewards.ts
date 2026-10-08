import type { EntityImage } from "@/lib/queries/images";
import type { StageKind } from "@/lib/types/stage";

export interface DialogueItem {
  itemId: number;
  itemName: string | null;
  qty: number | null;
  durationMin: number | null;
  icon: EntityImage | null;
}

export interface DialogueGrant {
  grantId: number;
  qty: number | null;
  durationMin: number | null;
  costItems: DialogueItem[];
  costGold: number | null;
  returns: DialogueItem[];
  triggers: { bind: string | null; monsterId: number | null; monsterName: string | null }[];
}

export interface NpcDialogueSource {
  npcId: number | null;
  npcName: string | null;
  orphan: boolean;
  rewards: DialogueGrant[];
}

export interface MapDialogueSource {
  stageKind: StageKind;
  stageId: number;
  stageName: string | null;
  rewards: DialogueGrant[];
}
